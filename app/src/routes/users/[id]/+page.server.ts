import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Mirrors the `char_length(display_name) between 1 and 50` check constraint
// on profiles (schema 001). Keeping the numeric literal in sync with the DB
// is the whole point of duplicating it -- surface a friendly message before
// the DB rejects the write with an opaque 23514 error.
const MAX_DISPLAY_NAME_LENGTH = 50;

type RatingRow = {
	id: string;
	rating: number;
	visited_at: string;
	created_at: string;
	cafes: { id: string; name: string; area: string | null } | null;
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}

	// Profiles RLS lets you SELECT a profile only if you share a group with
	// that user (or it's your own). We use .maybeSingle() so the "no shared
	// group" case returns null instead of an error. Both null-data AND any
	// error are collapsed to 404 so an attacker cannot distinguish
	// "nonexistent user" from "existing but hidden" by probing IDs.
	const { data: profile, error: profileErr } = await locals.supabase
		.from('profiles')
		.select('id, display_name')
		.eq('id', params.id)
		.maybeSingle();

	if (profileErr || !profile) {
		error(404, 'Profile not found');
	}

	// RLS policy "View connected users ratings" scopes this join to ratings
	// from users the caller shares a group with. Since we already verified
	// the profile is visible above, this will typically return all of the
	// target user's ratings -- but the policy is still the authoritative
	// guard here, not this condition.
	const { data: ratingRows } = await locals.supabase
		.from('ratings')
		.select('id, rating, visited_at, created_at, cafes(id, name, area)')
		.eq('user_id', params.id)
		.order('visited_at', { ascending: false });

	const ratings = ((ratingRows ?? []) as RatingRow[]).map((r) => ({
		id: r.id,
		rating: r.rating,
		visited_at: r.visited_at,
		cafe_id: r.cafes?.id ?? null,
		cafe_name: r.cafes?.name ?? 'Unknown cafe',
		cafe_area: r.cafes?.area ?? null
	}));

	return { profile, ratings };
};

export const actions: Actions = {
	// Self-only. RLS policy "Update own profile" enforces `id = auth.uid()`.
	// We still scope the UPDATE by the session user's id (not params.id) so
	// the intent of this action is unambiguous even if the RLS policy ever
	// widens in future.
	updateDisplayName: async ({ locals, request, url }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
		}

		const form = await request.formData();
		const rawName = String(form.get('display_name') ?? '');
		const name = rawName.trim();

		if (name.length === 0) {
			return fail(400, { error: 'Please enter a display name.', displayName: rawName });
		}
		if (name.length > MAX_DISPLAY_NAME_LENGTH) {
			return fail(400, {
				error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
				displayName: rawName
			});
		}

		const { error: updateErr } = await locals.supabase
			.from('profiles')
			.update({ display_name: name })
			.eq('id', user.id);

		if (updateErr) {
			return fail(500, {
				error: 'Could not update display name. Please try again.',
				displayName: rawName
			});
		}

		return { success: true };
	}
};
