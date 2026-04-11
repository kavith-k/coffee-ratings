import { describe, it, expect, vi } from 'vitest';
import { load, actions } from './+page.server';

/**
 * Tests the /groups/new create-group flow. Bugs these tests catch:
 *   - bypassing the `create_group` RPC (would break the security invariant
 *     that group + admin membership are created atomically)
 *   - accepting empty/whitespace-only names (would 500 via the DB check)
 *   - accepting names longer than 100 chars (would 500 via the DB check)
 *   - leaking raw RPC error messages to users
 *   - forgetting to trim whitespace (confusing " My Group " vs "My Group")
 *   - forgetting the auth guard on the load
 */

function buildFormEvent(body: Record<string, string>, overrides: Partial<Record<string, unknown>> = {}) {
	const formData = new URLSearchParams();
	for (const [k, v] of Object.entries(body)) formData.set(k, v);

	return {
		locals: {
			supabase: { rpc: vi.fn() } as never,
			safeGetSession: vi
				.fn()
				.mockResolvedValue({ session: { user: { id: 'u1' } }, user: { id: 'u1' } })
		},
		url: new URL('http://localhost:5173/groups/new'),
		request: new Request('http://localhost:5173/groups/new', {
			method: 'POST',
			body: formData,
			headers: { 'content-type': 'application/x-www-form-urlencoded' }
		}),
		...overrides
	} as never;
}

describe('/groups/new load', () => {
	it("redirects unauth'd users to /auth/login?next=/groups/new", async () => {
		const event = {
			locals: {
				supabase: {} as never,
				safeGetSession: vi.fn().mockResolvedValue({ session: null, user: null })
			},
			url: new URL('http://localhost:5173/groups/new')
		} as never;

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fgroups%2Fnew'
		});
	});
});

describe('/groups/new default action', () => {
	it('rejects an empty name with a 400 and does not call the RPC', async () => {
		const event = buildFormEvent({ name: '' });
		const result = (await actions.default(event)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/name/i);
		expect((event as { locals: { supabase: { rpc: ReturnType<typeof vi.fn> } } }).locals.supabase.rpc).not.toHaveBeenCalled();
	});

	it('rejects whitespace-only names with a 400', async () => {
		const event = buildFormEvent({ name: '   ' });
		const result = (await actions.default(event)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect((event as { locals: { supabase: { rpc: ReturnType<typeof vi.fn> } } }).locals.supabase.rpc).not.toHaveBeenCalled();
	});

	it('rejects names longer than 100 characters with a 400', async () => {
		const event = buildFormEvent({ name: 'a'.repeat(101) });
		const result = (await actions.default(event)) as { status: number; data: { error: string } };
		expect(result.status).toBe(400);
		expect((event as { locals: { supabase: { rpc: ReturnType<typeof vi.fn> } } }).locals.supabase.rpc).not.toHaveBeenCalled();
	});

	it('calls create_group with the trimmed name and redirects on success', async () => {
		const event = buildFormEvent({ name: '  Weekend wanderers  ' });
		(event as { locals: { supabase: { rpc: ReturnType<typeof vi.fn> } } }).locals.supabase.rpc.mockResolvedValue({
			data: 'new-group-id',
			error: null
		});

		await expect(actions.default(event)).rejects.toMatchObject({
			status: 303,
			location: '/groups/new-group-id'
		});

		expect((event as { locals: { supabase: { rpc: ReturnType<typeof vi.fn> } } }).locals.supabase.rpc).toHaveBeenCalledWith('create_group', {
			p_name: 'Weekend wanderers'
		});
	});

	it('maps RPC errors to a friendly message without leaking the raw error', async () => {
		const event = buildFormEvent({ name: 'My group' });
		(event as { locals: { supabase: { rpc: ReturnType<typeof vi.fn> } } }).locals.supabase.rpc.mockResolvedValue({
			data: null,
			error: { message: 'permission denied for function create_group' }
		});

		const result = (await actions.default(event)) as { status: number; data: { error: string } };
		expect(result.status).toBe(500);
		expect(result.data.error).not.toMatch(/permission denied/);
		expect(result.data.error).toMatch(/could not create/i);
	});

	it("redirects unauth'd callers to login before touching the RPC", async () => {
		const event = buildFormEvent({ name: 'My group' });
		(event as { locals: { safeGetSession: ReturnType<typeof vi.fn> } }).locals.safeGetSession = vi
			.fn()
			.mockResolvedValue({ session: null, user: null });

		await expect(actions.default(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fgroups%2Fnew'
		});
		expect((event as { locals: { supabase: { rpc: ReturnType<typeof vi.fn> } } }).locals.supabase.rpc).not.toHaveBeenCalled();
	});
});
