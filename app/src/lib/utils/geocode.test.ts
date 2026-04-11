import { describe, it, expect, vi } from 'vitest';
import { geocode } from './geocode';

/**
 * Tests for the Nominatim geocode utility. Bugs these tests catch:
 *   - forgetting the User-Agent header (Nominatim bans agentless callers,
 *     would silently fail in prod)
 *   - crashing on empty results instead of returning null (callers would
 *     see a 500 when a cafe name doesn't geocode)
 *   - crashing on network errors instead of returning null (same)
 *   - parsing the wrong fields off the Nominatim response (would set
 *     lat/lng to NaN or undefined)
 */

describe('geocode', () => {
	it('returns lat/lng from the first Nominatim result', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify([
					{ lat: '53.3498', lon: '-6.2603', display_name: 'Dublin' }
				]),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		const result = await geocode('Some Cafe, Dublin', fetchMock);

		expect(result).toEqual({ lat: 53.3498, lng: -6.2603 });
	});

	it('sends a User-Agent header (Nominatim policy)', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
		);

		await geocode('Anywhere', fetchMock);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, init] = fetchMock.mock.calls[0];
		const headers = new Headers(init?.headers);
		expect(headers.get('user-agent')).toBeTruthy();
		expect(headers.get('user-agent')).toMatch(/coffee-ratings/i);
	});

	it('returns null when Nominatim returns no results', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
		);

		const result = await geocode('jhgfjhgf ftgghjghjgh', fetchMock);
		expect(result).toBeNull();
	});

	it('returns null when the fetch throws', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
		const result = await geocode('Anywhere', fetchMock);
		expect(result).toBeNull();
	});

	it('returns null on a non-2xx response', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('rate limited', { status: 429 })
		);
		const result = await geocode('Anywhere', fetchMock);
		expect(result).toBeNull();
	});

	it('URL-encodes the query', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
		);

		await geocode('Third Place Cafe, D7', fetchMock);

		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain(encodeURIComponent('Third Place Cafe, D7'));
		expect(url).not.toContain('Third Place Cafe, D7'); // the raw string must be encoded
	});
});
