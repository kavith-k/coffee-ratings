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
 *   - forgetting the area filter ?area= param
 *   - returning cafes without the list of distinct areas needed to populate
 *     the area filter dropdown
 *   - crashing when the RPC or areas query returns an empty array
 */

type TerminalResult = { data: unknown; error: unknown };

function buildEvent(opts: {
	rpcResult?: TerminalResult;
	areasResult?: TerminalResult;
	authenticated?: boolean;
	url?: string;
}) {
	const rpcMock = vi.fn().mockResolvedValue(opts.rpcResult ?? { data: [], error: null });

	const areasChain: Record<string, unknown> = {};
	areasChain.select = vi.fn().mockReturnValue(areasChain);
	areasChain.not = vi.fn().mockResolvedValue(opts.areasResult ?? { data: [], error: null });

	const fromMock = vi.fn((table: string) => {
		if (table === 'cafes') return areasChain;
		throw new Error('unexpected table: ' + table);
	});

	return {
		event: {
			locals: {
				supabase: { rpc: rpcMock, from: fromMock } as never,
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
		rpcMock,
		areasChain,
		fromMock
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

		// p_area is `undefined` (not `null`) to match the generated RPC
		// types. PostgREST treats absent params as SQL NULL, which is the
		// "no filter" branch in the RPC.
		expect(rpcMock).toHaveBeenCalledWith('get_personalised_cafe_list', {
			p_area: undefined,
			p_sort_by: 'avg_rating',
			p_limit: 50,
			p_offset: 0
		});
	});

	it('passes ?area= through to p_area', async () => {
		const { event, rpcMock } = buildEvent({
			url: 'http://localhost:5173/?area=Phibsborough'
		});

		await load(event);

		expect(rpcMock).toHaveBeenCalledWith(
			'get_personalised_cafe_list',
			expect.objectContaining({ p_area: 'Phibsborough' })
		);
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

	it('returns cafes, distinct areas, and the active filter+sort state', async () => {
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
		const areasRaw = [
			{ area: 'Grand Canal' },
			{ area: 'Creative Quarter' },
			{ area: 'Grand Canal' }, // duplicate -- should be deduped
			{ area: 'Phibsborough' }
		];

		const { event, areasChain } = buildEvent({
			rpcResult: { data: cafes, error: null },
			areasResult: { data: areasRaw, error: null },
			url: 'http://localhost:5173/?area=Grand%20Canal&sort=num_ratings'
		});

		const result = (await load(event)) as unknown as {
			cafes: typeof cafes;
			areas: string[];
			activeArea: string | null;
			activeSort: string;
		};

		expect(result.cafes).toEqual(cafes);
		// Sorted, deduped, nulls stripped.
		expect(result.areas).toEqual(['Creative Quarter', 'Grand Canal', 'Phibsborough']);
		expect(result.activeArea).toBe('Grand Canal');
		expect(result.activeSort).toBe('num_ratings');

		// The areas query scopes to cafes with a non-null area.
		expect(areasChain.select).toHaveBeenCalledWith('area');
		expect(areasChain.not).toHaveBeenCalledWith('area', 'is', null);
	});

	it('returns empty arrays when there is no data', async () => {
		const { event } = buildEvent({
			rpcResult: { data: null, error: null },
			areasResult: { data: null, error: null }
		});

		const result = (await load(event)) as unknown as {
			cafes: unknown[];
			areas: string[];
		};

		expect(result.cafes).toEqual([]);
		expect(result.areas).toEqual([]);
	});

	it('throws when the RPC errors (surface failure rather than render a broken list)', async () => {
		const { event } = buildEvent({
			rpcResult: { data: null, error: { message: 'boom' } }
		});

		await expect(load(event)).rejects.toBeTruthy();
	});
});
