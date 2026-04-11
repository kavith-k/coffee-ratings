import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server';

/**
 * These tests cover the /groups list page load function. The bugs each test
 * catches:
 *   - forgetting the auth guard (would leak which groups exist if anonymous
 *     access ever slipped past -- RLS would stop it, but belt and braces)
 *   - forgetting the `?next=` param (user lands on /groups after login, not /)
 *   - selecting the wrong columns or wrong table (caught by column assertion)
 */

function mockSupabase(groupsResult: { data: unknown; error: unknown }) {
	const orderMock = vi.fn().mockResolvedValue(groupsResult);
	const selectMock = vi.fn().mockReturnValue({ order: orderMock });
	const fromMock = vi.fn().mockReturnValue({ select: selectMock });
	return { client: { from: fromMock } as never, fromMock, selectMock, orderMock };
}

describe('/groups load', () => {
	it("redirects unauth'd users to /auth/login?next=/groups", async () => {
		const event = {
			locals: {
				supabase: {} as never,
				safeGetSession: vi.fn().mockResolvedValue({ session: null, user: null })
			},
			url: new URL('http://localhost:5173/groups')
		} as never;

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fgroups'
		});
	});

	it("returns the user's groups ordered by newest first", async () => {
		const groups = [
			{ id: 'g1', name: 'Morning crew' },
			{ id: 'g2', name: 'Weekend wanderers' }
		];
		const { client, fromMock, selectMock, orderMock } = mockSupabase({
			data: groups,
			error: null
		});

		const event = {
			locals: {
				supabase: client,
				safeGetSession: vi
					.fn()
					.mockResolvedValue({ session: { user: { id: 'u1' } }, user: { id: 'u1' } })
			},
			url: new URL('http://localhost:5173/groups')
		} as never;

		const result = await load(event);

		expect(fromMock).toHaveBeenCalledWith('groups');
		expect(selectMock).toHaveBeenCalledWith('id, name');
		expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
		expect(result).toEqual({ groups });
	});

	it('returns an empty array when the user has no groups', async () => {
		// Regression guard: Supabase returns `data: null` when there are no rows
		// AND the caller used `.single()`. We don't use `.single()` here, so
		// `data` will be `[]`, but guard against future refactors that might
		// accidentally introduce `.maybeSingle()` or similar.
		const { client } = mockSupabase({ data: null, error: null });
		const event = {
			locals: {
				supabase: client,
				safeGetSession: vi
					.fn()
					.mockResolvedValue({ session: { user: { id: 'u1' } }, user: { id: 'u1' } })
			},
			url: new URL('http://localhost:5173/groups')
		} as never;

		const result = await load(event);
		expect(result).toEqual({ groups: [] });
	});
});
