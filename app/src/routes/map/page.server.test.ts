import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server';

/**
 * /map load function. Loads all cafes with personalised averages for the map.
 *
 * Bugs these tests catch:
 *   - forgetting the auth guard (map is auth-required)
 *   - passing a low limit that truncates the cafe list (map needs all cafes)
 *   - including cafes without coordinates, which would crash Leaflet
 *   - crashing when the RPC returns an empty array or null
 *   - surfacing RPC errors instead of rendering a broken map
 */

function buildEvent(opts: {
	rpcResult?: { data: unknown; error: unknown };
	authenticated?: boolean;
}) {
	const rpcMock = vi.fn().mockResolvedValue(opts.rpcResult ?? { data: [], error: null });

	return {
		event: {
			locals: {
				supabase: { rpc: rpcMock } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: { session: { user: { id: 'u1' } }, user: { id: 'u1' } }
				)
			},
			url: new URL('http://localhost:5173/map')
		} as never,
		rpcMock
	};
}

describe('/map load', () => {
	it("redirects unauth'd users to /auth/login?next=/map", async () => {
		const { event } = buildEvent({ authenticated: false });

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fmap'
		});
	});

	it('calls get_personalised_cafe_list with a high limit and no area filter', async () => {
		const { event, rpcMock } = buildEvent({});

		await load(event);

		expect(rpcMock).toHaveBeenCalledWith('get_personalised_cafe_list', {
			p_limit: 500,
			p_offset: 0
		});
	});

	it('filters out cafes without coordinates or without a rating', async () => {
		const cafes = [
			{ cafe_id: 'c1', cafe_name: 'Rated', lat: 53.3, lng: -6.2, avg_rating: 5.0 },
			{ cafe_id: 'c2', cafe_name: 'No lat', lat: null, lng: -6.2, avg_rating: 4.0 },
			{ cafe_id: 'c3', cafe_name: 'No lng', lat: 53.3, lng: null, avg_rating: 3.0 },
			{ cafe_id: 'c4', cafe_name: 'Unrated', lat: 53.3, lng: -6.2, avg_rating: null },
			{ cafe_id: 'c5', cafe_name: 'Both null', lat: null, lng: null, avg_rating: null }
		];

		const { event } = buildEvent({ rpcResult: { data: cafes, error: null } });

		const result = (await load(event)) as unknown as { cafes: typeof cafes };

		expect(result.cafes).toHaveLength(1);
		expect(result.cafes[0].cafe_id).toBe('c1');
	});

	it('returns an empty array when the RPC returns null', async () => {
		const { event } = buildEvent({ rpcResult: { data: null, error: null } });

		const result = (await load(event)) as unknown as { cafes: unknown[] };

		expect(result.cafes).toEqual([]);
	});

	it('returns an empty array when no cafes have coordinates', async () => {
		const cafes = [
			{ cafe_id: 'c1', cafe_name: 'No coords', lat: null, lng: null, avg_rating: null }
		];

		const { event } = buildEvent({ rpcResult: { data: cafes, error: null } });

		const result = (await load(event)) as unknown as { cafes: unknown[] };

		expect(result.cafes).toEqual([]);
	});

	it('throws when the RPC errors', async () => {
		const { event } = buildEvent({
			rpcResult: { data: null, error: { message: 'boom' } }
		});

		await expect(load(event)).rejects.toBeTruthy();
	});
});
