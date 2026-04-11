import { describe, it, expect } from 'vitest';
import { getRatingBucket } from './rating-colour';

/**
 * Colour bucket mapping for rating badges. Boundaries live in
 * build-docs/08-components.md:
 *   0.0-2.0  red
 *   2.1-4.0  orange
 *   4.1-5.0  yellow
 *   5.1-6.0  green
 *   6.1-7.0  emerald (dark green)
 *
 * Bugs these tests catch:
 *   - off-by-one at the boundaries (e.g. 2.0 landing in orange instead of
 *     red because of a `>=` instead of `>`)
 *   - forgetting the null case (unrated cafes still render a badge)
 *   - letting out-of-range values slip through instead of clamping
 */

describe('getRatingBucket', () => {
	it('returns "none" for null', () => {
		expect(getRatingBucket(null)).toBe('none');
	});

	it('maps 0.0 to red', () => {
		expect(getRatingBucket(0)).toBe('red');
	});

	it('maps 2.0 (upper red boundary) to red', () => {
		expect(getRatingBucket(2.0)).toBe('red');
	});

	it('maps 2.1 to orange', () => {
		expect(getRatingBucket(2.1)).toBe('orange');
	});

	it('maps 4.0 (upper orange boundary) to orange', () => {
		expect(getRatingBucket(4.0)).toBe('orange');
	});

	it('maps 4.1 to yellow', () => {
		expect(getRatingBucket(4.1)).toBe('yellow');
	});

	it('maps 5.0 (upper yellow boundary) to yellow', () => {
		expect(getRatingBucket(5.0)).toBe('yellow');
	});

	it('maps 5.1 to green', () => {
		expect(getRatingBucket(5.1)).toBe('green');
	});

	it('maps 6.0 (upper green boundary) to green', () => {
		expect(getRatingBucket(6.0)).toBe('green');
	});

	it('maps 6.1 to emerald', () => {
		expect(getRatingBucket(6.1)).toBe('emerald');
	});

	it('maps 7.0 (top) to emerald', () => {
		expect(getRatingBucket(7.0)).toBe('emerald');
	});

	it('clamps values above 7 to emerald (defensive -- DB constraint blocks them)', () => {
		expect(getRatingBucket(9)).toBe('emerald');
	});

	it('clamps values below 0 to red (defensive)', () => {
		expect(getRatingBucket(-1)).toBe('red');
	});
});
