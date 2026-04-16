import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server';

/**
 * Home page (/) load function. This is the personalised ranked cafe list --
 * the first thing a logged-in user sees.
 *
 * Bugs these tests catch:
 *   - forgetting the auth guard (home is auth-required)
 *   - forgetting the ?next= param on the login redirect (user would land on
 *     / after login, which is fine here, but we want the pattern consistent
 *     with the rest of the app so it keeps working when / isn't the target)
 *   - passing a user-controlled sort_by string straight to the RPC. Even
 *     though the RPC is parameterised (no SQLi), an unknown value silently
 *     degrades the ORDER BY to the c.name fallback inside the SQL and the
 *     home page would appear to "forget" how to sort
 *   - crashing when the RPC returns an empty array
 */

type TerminalResult = { data: unknown; error: unknown };

function buildEvent(opts: {
	rpcResult?: TerminalResult;
	authenticated?: boolean;
	url?: string;
}) {
	const rpcMock = vi.fn().mockResolvedValue(opts.rpcResult ?? { data: [], error: null });

	return {
		event: {
			locals: {
				supabase: { rpc: rpcMock } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: {
								session: { user: { id: 'u1' } },
								user: { id: 'u1' }
							}
				)
			},
			url: new URL(opts.url ?? 'http://localhost:5173/')
		} as never,
		rpcMock
	};
}

describe('/ (home) load', () => {
	it("redirects unauth'd users to /auth/login?next=/", async () => {
		const { event } = buildEvent({ authenticated: false });

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2F'
		});
	});

	it('calls get_personalised_cafe_list with default params when no query string', async () => {
		const { event, rpcMock } = buildEvent({});

		await load(event);

		expect(rpcMock).toHaveBeenCalledWith('get_personalised_cafe_list', {
			p_sort_by: 'avg_rating',
			p_limit: 50,
			p_offset: 0
		});
	});

	it('passes ?sort=num_ratings through to p_sort_by', async () => {
		const { event, rpcMock } = buildEvent({
			url: 'http://localhost:5173/?sort=num_ratings'
		});

		await load(event);

		expect(rpcMock).toHaveBeenCalledWith(
			'get_personalised_cafe_list',
			expect.objectContaining({ p_sort_by: 'num_ratings' })
		);
	});

	it('whitelists sort_by: unknown values fall back to avg_rating', async () => {
		const { event, rpcMock } = buildEvent({
			url: 'http://localhost:5173/?sort=drop_table'
		});

		await load(event);

		expect(rpcMock).toHaveBeenCalledWith(
			'get_personalised_cafe_list',
			expect.objectContaining({ p_sort_by: 'avg_rating' })
		);
	});

	it('returns cafes and the active sort state', async () => {
		const cafes = [
			{
				cafe_id: 'c1',
				cafe_name: '3fe',
				area: 'Grand Canal',
				lat: 53.3,
				lng: -6.2,
				avg_rating: 6.4,
				num_ratings: 12,
				num_raters: 5
			},
			{
				cafe_id: 'c2',
				cafe_name: 'Kaph',
				area: 'Creative Quarter',
				lat: 53.34,
				lng: -6.26,
				avg_rating: 5.9,
				num_ratings: 8,
				num_raters: 4
			}
		];

		const { event } = buildEvent({
			rpcResult: { data: cafes, error: null },
			url: 'http://localhost:5173/?sort=num_ratings'
		});

		const result = (await load(event)) as unknown as {
			cafes: typeof cafes;
			activeSort: string;
		};

		expect(result.cafes).toEqual(cafes);
		expect(result.activeSort).toBe('num_ratings');
	});

	it('filters out unrated cafes (null avg_rating)', async () => {
		const cafes = [
			{ cafe_id: 'c1', cafe_name: 'Rated', avg_rating: 5.0 },
			{ cafe_id: 'c2', cafe_name: 'Unrated', avg_rating: null }
		];

		const { event } = buildEvent({ rpcResult: { data: cafes, error: null } });

		const result = (await load(event)) as unknown as { cafes: typeof cafes };

		expect(result.cafes).toHaveLength(1);
		expect(result.cafes[0].cafe_id).toBe('c1');
	});

	it('returns an empty cafes array when the RPC returns no data', async () => {
		const { event } = buildEvent({
			rpcResult: { data: null, error: null }
		});

		const result = (await load(event)) as unknown as { cafes: unknown[] };

		expect(result.cafes).toEqual([]);
	});

	it('throws when the RPC errors (surface failure rather than render a broken list)', async () => {
		const { event } = buildEvent({
			rpcResult: { data: null, error: { message: 'boom' } }
		});

		await expect(load(event)).rejects.toBeTruthy();
	});
});
