import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server';

/**
 * /join/[code] is the invite flow. Bugs these tests catch:
 *   - leaking raw RPC errors to users (security + UX)
 *   - throwing on invalid code instead of rendering a friendly page
 *     (would hand anonymous callers a 500 instead of "invalid link")
 *   - calling the wrong RPC (preview vs join) based on auth state
 *   - forgetting to redirect to /groups/[id] on successful join
 *   - idempotency: re-joining as an existing member should still redirect
 *     (the underlying RPC is idempotent, but the load function must not
 *     treat a successful join of an already-member as an error)
 */

function buildEvent(opts: {
	authenticated: boolean;
	code: string;
	rpcImpl?: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>;
}) {
	const rpc = vi.fn(
		opts.rpcImpl ??
			(async () => ({ data: null, error: null }))
	);
	return {
		locals: {
			supabase: { rpc } as never,
			safeGetSession: vi.fn().mockResolvedValue(
				opts.authenticated
					? { session: { user: { id: 'u1' } }, user: { id: 'u1' } }
					: { session: null, user: null }
			)
		},
		url: new URL(`http://localhost:5173/join/${opts.code}`),
		params: { code: opts.code }
	} as never;
}

describe('/join/[code] load -- unauthenticated', () => {
	it('returns group preview from get_group_preview_by_invite_code', async () => {
		const event = buildEvent({
			authenticated: false,
			code: 'abc123',
			rpcImpl: async (name, args) => {
				expect(name).toBe('get_group_preview_by_invite_code');
				expect(args).toEqual({ code: 'abc123' });
				return { data: [{ name: 'Morning crew', member_count: 4 }], error: null };
			}
		});

		const result = (await load(event)) as unknown as {
			authenticated: boolean;
			inviteCode: string;
			groupPreview: { name: string; member_count: number } | null;
		};

		expect(result).toEqual({
			authenticated: false,
			inviteCode: 'abc123',
			groupPreview: { name: 'Morning crew', member_count: 4 }
		});
	});

	it('returns groupPreview: null for an invalid code without throwing', async () => {
		const event = buildEvent({
			authenticated: false,
			code: 'bogus',
			rpcImpl: async () => ({ data: [], error: null })
		});

		const result = (await load(event)) as unknown as { groupPreview: unknown };
		expect(result.groupPreview).toBeNull();
	});

	it('returns groupPreview: null even if the RPC errors (no stack traces to anons)', async () => {
		const event = buildEvent({
			authenticated: false,
			code: 'bogus',
			rpcImpl: async () => ({ data: null, error: { message: 'something went wrong' } })
		});

		const result = (await load(event)) as unknown as { groupPreview: unknown; authenticated: boolean };
		expect(result.groupPreview).toBeNull();
		expect(result.authenticated).toBe(false);
	});
});

describe('/join/[code] load -- authenticated', () => {
	it('calls join_group_by_invite_code and redirects to /groups/[id] on success', async () => {
		const event = buildEvent({
			authenticated: true,
			code: 'abc123',
			rpcImpl: async (name, args) => {
				expect(name).toBe('join_group_by_invite_code');
				expect(args).toEqual({ code: 'abc123' });
				return { data: 'joined-group-id', error: null };
			}
		});

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/groups/joined-group-id'
		});
	});

	it('returns a friendly error payload (not the raw RPC message) on invalid code', async () => {
		const event = buildEvent({
			authenticated: true,
			code: 'bogus',
			rpcImpl: async () => ({
				data: null,
				error: { message: 'Invalid invite code' } // raw Postgres exception text
			})
		});

		const result = (await load(event)) as unknown as {
			authenticated: boolean;
			error: string;
		};
		expect(result.authenticated).toBe(true);
		expect(result.error).toBe('Invalid or expired invite link');
		expect(result.error).not.toMatch(/invite code/i); // must NOT include the raw text
	});
});
