import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server';

/**
 * /users/[id] profile page load.
 *
 * Bugs these tests catch:
 *   - missing auth guard (profile history must be login-gated)
 *   - returning a distinct "not visible to you" error for an existing but
 *     RLS-hidden profile, which would leak existence. Both "nonexistent"
 *     and "hidden" must 404 identically.
 *   - using `.single()` (which errors on zero rows) instead of `.maybeSingle()`
 *     for the profile lookup
 *   - returning the raw cafes join (wrong shape) instead of flat fields
 *   - sorting ratings in the wrong order (must be visited_at desc so the
 *     most recent visit is first, matching cafe-detail's convention)
 */

type TerminalResult = { data: unknown; error: unknown };

function buildEvent(opts: {
	profileResult?: TerminalResult;
	ratingsResult?: TerminalResult;
	authenticated?: boolean;
	targetId?: string;
}) {
	const profileChain: Record<string, unknown> = {};
	profileChain.select = vi.fn().mockReturnValue(profileChain);
	profileChain.eq = vi.fn().mockReturnValue(profileChain);
	profileChain.maybeSingle = vi
		.fn()
		.mockResolvedValue(opts.profileResult ?? { data: null, error: null });

	const ratingsChain: Record<string, unknown> = {};
	ratingsChain.select = vi.fn().mockReturnValue(ratingsChain);
	ratingsChain.eq = vi.fn().mockReturnValue(ratingsChain);
	ratingsChain.order = vi.fn().mockResolvedValue(opts.ratingsResult ?? { data: [], error: null });

	const fromMock = vi.fn((table: string) => {
		if (table === 'profiles') return profileChain;
		if (table === 'ratings') return ratingsChain;
		throw new Error('unexpected table: ' + table);
	});

	return {
		event: {
			locals: {
				supabase: { from: fromMock } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: {
								session: { user: { id: 'me' } },
								user: { id: 'me' }
							}
				)
			},
			url: new URL('http://localhost:5173/users/' + (opts.targetId ?? 'u1')),
			params: { id: opts.targetId ?? 'u1' }
		} as never,
		profileChain,
		ratingsChain
	};
}

describe('/users/[id] load', () => {
	it("redirects unauth'd users to /auth/login?next=/users/u1", async () => {
		const { event } = buildEvent({ authenticated: false });

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fusers%2Fu1'
		});
	});

	it('returns 404 when the profile is null (nonexistent or RLS-hidden)', async () => {
		// This is the critical existence-leak guard. RLS lets you read a
		// profile only if you share a group with that user; if you don't,
		// the select returns `data: null` with no error. We treat that
		// identically to "doesn't exist" so an attacker can't distinguish
		// the two cases by probing user IDs.
		const { event } = buildEvent({
			profileResult: { data: null, error: null }
		});

		await expect(load(event)).rejects.toMatchObject({ status: 404 });
	});

	it('returns 404 when maybeSingle errors (treat as not found, not 500)', async () => {
		const { event } = buildEvent({
			profileResult: { data: null, error: { message: 'boom' } }
		});

		await expect(load(event)).rejects.toMatchObject({ status: 404 });
	});

	it('returns profile + ratings shaped for the page', async () => {
		const { event, profileChain, ratingsChain } = buildEvent({
			profileResult: {
				data: { id: 'u1', display_name: 'Alice' },
				error: null
			},
			ratingsResult: {
				data: [
					{
						id: 'r1',
						rating: 6.5,
						visited_at: '2026-03-20',
						created_at: '2026-03-21T10:00:00Z',
						cafes: { id: 'c1', name: '3fe', area: 'Grand Canal' }
					},
					{
						id: 'r2',
						rating: 4.0,
						visited_at: '2026-02-10',
						created_at: '2026-02-11T10:00:00Z',
						cafes: { id: 'c2', name: 'Kaph', area: 'Creative Quarter' }
					}
				],
				error: null
			}
		});

		const result = (await load(event)) as unknown as {
			profile: { id: string; display_name: string };
			ratings: Array<{
				id: string;
				rating: number;
				visited_at: string;
				cafe_id: string;
				cafe_name: string;
				cafe_area: string | null;
			}>;
		};

		expect(result.profile).toEqual({ id: 'u1', display_name: 'Alice' });
		expect(result.ratings).toHaveLength(2);
		expect(result.ratings[0]).toEqual({
			id: 'r1',
			rating: 6.5,
			visited_at: '2026-03-20',
			cafe_id: 'c1',
			cafe_name: '3fe',
			cafe_area: 'Grand Canal'
		});

		// Lock in that we're querying by the url param and sorting most-recent first.
		expect(profileChain.eq).toHaveBeenCalledWith('id', 'u1');
		expect(ratingsChain.eq).toHaveBeenCalledWith('user_id', 'u1');
		expect(ratingsChain.order).toHaveBeenCalledWith('visited_at', { ascending: false });
	});

	it('returns an empty ratings list when the user has not rated anything visible', async () => {
		// If a profile is visible but the user has no ratings (or none
		// visible to the caller), the page should still render cleanly.
		const { event } = buildEvent({
			profileResult: { data: { id: 'u1', display_name: 'Alice' }, error: null },
			ratingsResult: { data: null, error: null }
		});

		const result = (await load(event)) as unknown as { ratings: unknown[] };
		expect(result.ratings).toEqual([]);
	});

	it('handles malformed cafes join (null) without crashing', async () => {
		// Defensive: a rating with no cafe shouldn't exist (FK constraint),
		// but if the join returns null for some reason we'd rather render
		// "unknown cafe" than throw.
		const { event } = buildEvent({
			profileResult: { data: { id: 'u1', display_name: 'Alice' }, error: null },
			ratingsResult: {
				data: [
					{
						id: 'r1',
						rating: 5.0,
						visited_at: '2026-03-01',
						created_at: '2026-03-02T10:00:00Z',
						cafes: null
					}
				],
				error: null
			}
		});

		const result = (await load(event)) as unknown as {
			ratings: Array<{ cafe_id: string | null; cafe_name: string }>;
		};
		expect(result.ratings[0].cafe_id).toBeNull();
		expect(result.ratings[0].cafe_name).toBe('Unknown cafe');
	});
});
