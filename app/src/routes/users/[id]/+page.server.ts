import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
