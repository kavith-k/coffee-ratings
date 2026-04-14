import { describe, it, expect } from 'vitest';
import { MAP_DEFAULTS, getRatingHex } from './map';

/**
 * Map utility constants and marker colour mapping.
 *
 * Bugs these tests catch:
 *   - MAP_DEFAULTS centre or zoom drifting from the expected Dublin location
 *   - getRatingHex returning a Tailwind class instead of a hex string (Leaflet
 *     needs raw hex colours, not utility classes)
 *   - boundary mismatches between getRatingHex and getRatingBucket (both must
 *     agree on what colour a given rating produces)
 *   - forgetting the null/unrated case (must return grey, not a rated colour)
 */

describe('MAP_DEFAULTS', () => {
	it('centres on Dublin', () => {
		expect(MAP_DEFAULTS.centre).toEqual([53.3498, -6.2603]);
	});

	it('uses zoom level 13', () => {
		expect(MAP_DEFAULTS.zoom).toBe(13);
	});
});

describe('getRatingHex', () => {
	it('returns slate-blue for null (unrated) -- must contrast against grey basemap', () => {
		expect(getRatingHex(null)).toBe('#64748b');
	});

	it('returns red hex for low ratings (0-2)', () => {
		const hex = getRatingHex(1.5);
		expect(hex).toBe('#dc2626');
	});

	it('returns red hex at the upper boundary (2.0)', () => {
		expect(getRatingHex(2.0)).toBe('#dc2626');
	});

	it('returns orange hex for 2.1-4.0', () => {
		expect(getRatingHex(3.0)).toBe('#f97316');
	});

	it('returns orange hex at the upper boundary (4.0)', () => {
		expect(getRatingHex(4.0)).toBe('#f97316');
	});

	it('returns yellow hex for 4.1-5.0', () => {
		expect(getRatingHex(4.5)).toBe('#facc15');
	});

	it('returns green hex for 5.1-6.0', () => {
		expect(getRatingHex(5.5)).toBe('#16a34a');
	});

	it('returns emerald hex for 6.1-7.0', () => {
		expect(getRatingHex(6.5)).toBe('#047857');
	});

	it('returns emerald hex at the top (7.0)', () => {
		expect(getRatingHex(7.0)).toBe('#047857');
	});
});
