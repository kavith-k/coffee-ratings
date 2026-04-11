/**
 * Shared rating validation used by the server submit action and the
 * client-side RatingForm component. Keeping the rules in one place so the
 * form's disabled state and the server's rejection message agree.
 *
 * `rawRating` can be either a string (server, FormData values are always
 * strings) or a number (client, Svelte's `bind:value` on `<input type="number">`
 * coerces to a number). Both must be accepted. An empty numeric input binds
 * to `NaN`, which we treat as "no rating picked yet".
 *
 * Rules (mirrors schema constraints + product rules):
 *   - rating is a number in [0, 7]
 *   - rating has at most one decimal place (matches numeric(2,1))
 *   - visited_at is an ISO date (YYYY-MM-DD) not in the future
 */

export type RatingValidationResult =
	| { ok: true; rating: number; visited_at: string }
	| { ok: false; error: string };

function coerceRating(raw: unknown): number | null {
	if (typeof raw === 'number') {
		return Number.isNaN(raw) ? null : raw;
	}
	if (typeof raw === 'string') {
		if (raw.trim() === '') return null;
		const n = Number(raw);
		return Number.isFinite(n) ? n : NaN; // NaN sentinel = "not a number"
	}
	return null;
}

export function validateRatingInput(
	rawRating: unknown,
	rawVisitedAt: unknown,
	today: Date = new Date()
): RatingValidationResult {
	const rating = coerceRating(rawRating);
	if (rating === null) {
		return { ok: false, error: 'Please pick a rating.' };
	}
	if (!Number.isFinite(rating)) {
		return { ok: false, error: 'Rating must be a number.' };
	}
	if (rating < 0 || rating > 7) {
		return { ok: false, error: 'Rating must be between 0 and 7.' };
	}
	// Reject more than one decimal place by checking round-trip against
	// numeric(2,1) -- multiplying by 10 should yield an integer.
	if (Math.round(rating * 10) !== rating * 10) {
		return { ok: false, error: 'Rating can have at most one decimal place.' };
	}

	if (typeof rawVisitedAt !== 'string' || rawVisitedAt.trim() === '') {
		return { ok: false, error: 'Please pick a visit date.' };
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(rawVisitedAt)) {
		return { ok: false, error: 'Visit date must be a YYYY-MM-DD date.' };
	}
	const visited = new Date(rawVisitedAt + 'T00:00:00Z');
	if (Number.isNaN(visited.getTime())) {
		return { ok: false, error: 'Visit date is not a real date.' };
	}
	// Compare in UTC to avoid timezone drift. "Today" in user's local tz might
	// be "tomorrow" in UTC, but we don't want to block that; allow up to end
	// of UTC today.
	const endOfToday = new Date(
		Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59)
	);
	if (visited.getTime() > endOfToday.getTime()) {
		return { ok: false, error: 'Visit date cannot be in the future.' };
	}

	return { ok: true, rating, visited_at: rawVisitedAt };
}
