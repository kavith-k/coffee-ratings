import { describe, it, expect } from 'vitest';
import { validateRatingInput } from './rating-validation';

/**
 * These tests cover the edge cases that must agree between the server
 * submitRating action and the RatingForm component's client-side disabled
 * state. Bugs caught: client and server disagreeing on what's valid,
 * timezone drift letting "tomorrow" sneak through as valid.
 */

describe('validateRatingInput', () => {
	const today = new Date('2026-04-11T12:00:00Z');

	it('accepts a valid rating + date', () => {
		const r = validateRatingInput('5.3', '2026-04-11', today);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.rating).toBe(5.3);
			expect(r.visited_at).toBe('2026-04-11');
		}
	});

	it('accepts integer ratings', () => {
		const r = validateRatingInput('6', '2026-04-11', today);
		expect(r.ok).toBe(true);
	});

	it('accepts 0 and 7 (boundary)', () => {
		expect(validateRatingInput('0', '2026-04-11', today).ok).toBe(true);
		expect(validateRatingInput('7', '2026-04-11', today).ok).toBe(true);
	});

	it('rejects rating below 0', () => {
		const r = validateRatingInput('-0.1', '2026-04-11', today);
		expect(r.ok).toBe(false);
	});

	it('rejects rating above 7', () => {
		const r = validateRatingInput('7.1', '2026-04-11', today);
		expect(r.ok).toBe(false);
	});

	it('rejects more than one decimal place', () => {
		const r = validateRatingInput('5.55', '2026-04-11', today);
		expect(r.ok).toBe(false);
	});

	it('rejects NaN / non-numeric', () => {
		expect(validateRatingInput('abc', '2026-04-11', today).ok).toBe(false);
		expect(validateRatingInput('', '2026-04-11', today).ok).toBe(false);
	});

	it('rejects a future visit date', () => {
		const r = validateRatingInput('5.0', '2026-04-12', today);
		expect(r.ok).toBe(false);
	});

	it('rejects bad date format', () => {
		const r = validateRatingInput('5.0', '11/04/2026', today);
		expect(r.ok).toBe(false);
	});

	it('rejects empty visited_at', () => {
		const r = validateRatingInput('5.0', '', today);
		expect(r.ok).toBe(false);
	});

	it('accepts a past visit date', () => {
		const r = validateRatingInput('5.0', '2020-01-01', today);
		expect(r.ok).toBe(true);
	});

	// --- Client binding coercion: Svelte 5 `bind:value` on
	// `<input type="number">` gives us a number, not a string. The validator
	// must handle both since the same function runs on server (string from
	// FormData) and client (number from the DOM binding).

	it('accepts a numeric rating (client binding)', () => {
		const r = validateRatingInput(5.5, '2026-04-11', today);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.rating).toBe(5.5);
	});

	it('treats NaN (empty numeric input) as "no rating picked"', () => {
		const r = validateRatingInput(Number.NaN, '2026-04-11', today);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/pick a rating/i);
	});

	it('rejects a numeric rating above 7', () => {
		const r = validateRatingInput(7.5, '2026-04-11', today);
		expect(r.ok).toBe(false);
	});

	it('rejects a numeric rating with more than one decimal place', () => {
		const r = validateRatingInput(5.55, '2026-04-11', today);
		expect(r.ok).toBe(false);
	});
});
