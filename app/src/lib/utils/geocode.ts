/**
 * Geocode a free-text query via Nominatim (OpenStreetMap).
 *
 * Returns null on any failure (no results, network error, non-2xx). Callers
 * should treat null as "coordinates unknown" and allow the cafe to be saved
 * without them -- the schema permits null lat/lng.
 *
 * Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
 *   - max 1 req/sec (we only call on form submission, so naturally throttled)
 *   - must include a real User-Agent identifying the app
 *   - no bulk geocoding, no heavy automated use
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'coffee-ratings-app/0.0.1 (github.com/kavith/coffee-ratings)';

export type GeocodeResult = { lat: number; lng: number };

export async function geocode(
	query: string,
	fetchImpl: typeof fetch = fetch
): Promise<GeocodeResult | null> {
	const url = `${NOMINATIM_BASE}?format=json&limit=1&q=${encodeURIComponent(query)}`;

	try {
		const response = await fetchImpl(url, {
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'application/json'
			}
		});

		if (!response.ok) return null;

		const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
		if (!Array.isArray(rows) || rows.length === 0) return null;

		const first = rows[0];
		if (!first.lat || !first.lon) return null;

		const lat = Number(first.lat);
		const lng = Number(first.lon);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

		return { lat, lng };
	} catch {
		return null;
	}
}
