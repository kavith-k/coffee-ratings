import { describe, it, expect, vi } from 'vitest';
import { load, actions } from './+page.server';

/**
 * Tests for /groups/[id] load + three form actions. Bugs these tests catch:
 *   - returning a 500 instead of a clean 404 when a non-member hits the route
 *     (RLS filters the row, `.single()` returns data=null, error code PGRST116)
 *   - forgetting to derive isAdmin from the current user's membership row
 *   - delete/remove/leave actions using the wrong operation or filter, which
 *     would either silently no-op or delete the wrong rows (RLS will block
 *     malicious cases, but a buggy filter could still delete YOUR own row)
 *   - adding a client-side admin gate instead of relying on RLS (would drift
 *     from the DB policy and cause one of the two checks to become stale)
 */

// Chainable mock builder: each intermediate step returns `self`, and a
// terminal resolver returns { data, error }. Keeps tests readable.
function chain(terminal: { data: unknown; error: unknown }) {
	const node: Record<string, unknown> = {};
	const self = () => node;
	node.select = vi.fn(self);
	node.eq = vi.fn(self);
	node.order = vi.fn(self);
	node.match = vi.fn(self);
	node.single = vi.fn().mockResolvedValue(terminal);
	node.delete = vi.fn(self);
	// Make the whole chain thenable so `await supabase.from(...).delete().eq(...).select()` works
	node.then = (onFulfilled: (v: unknown) => unknown) =>
		Promise.resolve(terminal).then(onFulfilled);
	return node;
}

function buildLoadEvent(opts: {
	groupResult: { data: unknown; error: unknown };
	membersResult: { data: unknown; error: unknown };
	userId?: string;
}) {
	const groupChain = chain(opts.groupResult);
	const membersChain = chain(opts.membersResult);
	const fromMock = vi.fn((table: string) => {
		if (table === 'groups') return groupChain;
		if (table === 'group_members') return membersChain;
		throw new Error('unexpected table ' + table);
	});
	return {
		locals: {
			supabase: { from: fromMock } as never,
			safeGetSession: vi.fn().mockResolvedValue({
				session: { user: { id: opts.userId ?? 'u1' } },
				user: { id: opts.userId ?? 'u1' }
			})
		},
		url: new URL('http://localhost:5173/groups/grp-1'),
		params: { id: 'grp-1' }
	} as never;
}

describe('/groups/[id] load', () => {
	it("returns 404 when the user isn't a member (RLS filters row)", async () => {
		const event = buildLoadEvent({
			groupResult: { data: null, error: { code: 'PGRST116' } },
			membersResult: { data: [], error: null }
		});

		await expect(load(event)).rejects.toMatchObject({ status: 404 });
	});

	it('returns shaped data with isAdmin=true for the admin user', async () => {
		const event = buildLoadEvent({
			userId: 'u1',
			groupResult: {
				data: { id: 'grp-1', name: 'Morning crew', invite_code: 'deadbeef', created_by: 'u1' },
				error: null
			},
			membersResult: {
				data: [
					{ user_id: 'u1', role: 'admin', profiles: { display_name: 'Alice' } },
					{ user_id: 'u2', role: 'member', profiles: { display_name: 'Bob' } }
				],
				error: null
			}
		});

		const result = (await load(event)) as unknown as {
			group: { id: string; name: string };
			members: Array<{ user_id: string; role: string; display_name: string }>;
			isAdmin: boolean;
			inviteCode: string;
		};

		expect(result.group.name).toBe('Morning crew');
		expect(result.inviteCode).toBe('deadbeef');
		expect(result.isAdmin).toBe(true);
		expect(result.members).toHaveLength(2);
		expect(result.members[0]).toMatchObject({
			user_id: 'u1',
			role: 'admin',
			display_name: 'Alice'
		});
	});

	it('returns isAdmin=false for a plain member', async () => {
		const event = buildLoadEvent({
			userId: 'u2',
			groupResult: {
				data: { id: 'grp-1', name: 'Morning crew', invite_code: 'deadbeef', created_by: 'u1' },
				error: null
			},
			membersResult: {
				data: [
					{ user_id: 'u1', role: 'admin', profiles: { display_name: 'Alice' } },
					{ user_id: 'u2', role: 'member', profiles: { display_name: 'Bob' } }
				],
				error: null
			}
		});

		const result = (await load(event)) as unknown as { isAdmin: boolean };
		expect(result.isAdmin).toBe(false);
	});
});

// ---- Action tests ----

function buildActionEvent(opts: {
	actionBody: Record<string, string>;
	userId?: string;
	deleteResult?: { data: unknown; error: unknown };
}) {
	const terminal = opts.deleteResult ?? { data: null, error: null };
	const deleteChain = chain(terminal);
	const fromMock = vi.fn((table: string) => {
		if (table === 'groups' || table === 'group_members') return deleteChain;
		throw new Error('unexpected table ' + table);
	});
	const formData = new URLSearchParams();
	for (const [k, v] of Object.entries(opts.actionBody)) formData.set(k, v);

	return {
		event: {
			locals: {
				supabase: { from: fromMock } as never,
				safeGetSession: vi.fn().mockResolvedValue({
					session: { user: { id: opts.userId ?? 'u1' } },
					user: { id: opts.userId ?? 'u1' }
				})
			},
			url: new URL('http://localhost:5173/groups/grp-1'),
			params: { id: 'grp-1' },
			request: new Request('http://localhost:5173/groups/grp-1', {
				method: 'POST',
				body: formData
			})
		} as never,
		fromMock,
		deleteChain
	};
}

describe('/groups/[id] deleteGroup action', () => {
	it('deletes the group row then redirects to /groups (RLS gates admin-only)', async () => {
		const { event, fromMock, deleteChain } = buildActionEvent({ actionBody: {} });

		await expect(actions.deleteGroup(event)).rejects.toMatchObject({
			status: 303,
			location: '/groups'
		});

		expect(fromMock).toHaveBeenCalledWith('groups');
		expect(deleteChain.delete).toHaveBeenCalled();
		expect(deleteChain.eq).toHaveBeenCalledWith('id', 'grp-1');
	});

	it('surfaces a friendly failure if the delete errors (e.g. RLS rejection)', async () => {
		const { event } = buildActionEvent({
			actionBody: {},
			deleteResult: { data: null, error: { message: 'permission denied' } }
		});
		const result = (await actions.deleteGroup(event)) as { status: number; data: { error: string } };
		expect(result.status).toBe(500);
		expect(result.data.error).not.toMatch(/permission/i);
	});
});

describe('/groups/[id] removeMember action', () => {
	it('matches on both group_id and user_id (do not delete the whole group)', async () => {
		const { event, fromMock, deleteChain } = buildActionEvent({
			actionBody: { userId: 'u2' }
		});

		await actions.removeMember(event);

		expect(fromMock).toHaveBeenCalledWith('group_members');
		expect(deleteChain.delete).toHaveBeenCalled();
		expect(deleteChain.match).toHaveBeenCalledWith({
			group_id: 'grp-1',
			user_id: 'u2'
		});
	});

	it('returns 400 when userId is missing', async () => {
		const { event } = buildActionEvent({ actionBody: {} });
		const result = (await actions.removeMember(event)) as { status: number };
		expect(result.status).toBe(400);
	});
});

describe('/groups/[id] leaveGroup action', () => {
	it("deletes the caller's own membership row and redirects to /groups", async () => {
		const { event, fromMock, deleteChain } = buildActionEvent({
			userId: 'u2',
			actionBody: {}
		});

		await expect(actions.leaveGroup(event)).rejects.toMatchObject({
			status: 303,
			location: '/groups'
		});

		expect(fromMock).toHaveBeenCalledWith('group_members');
		expect(deleteChain.match).toHaveBeenCalledWith({
			group_id: 'grp-1',
			user_id: 'u2'
		});
	});
});
