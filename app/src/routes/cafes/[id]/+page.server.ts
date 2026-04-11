import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { validateRatingInput } from '$lib/utils/rating-validation';

type RatingRow = {
	id: string;
	rating: number;
	visited_at: string;
	created_at: string;
	user_id: string;
	profiles: { display_name: string } | null;
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}

	const { data: cafe, error: cafeErr } = await locals.supabase
		.from('cafes')
		.select('id, name, area, lat, lng')
		.eq('id', params.id)
		.single();

	if (cafeErr || !cafe) {
		error(404, 'Cafe not found');
	}

	// Stats are scoped to visible users (RPC uses visible_user_ids()). Empty
	// array means "no visible ratings yet" -- treat as zero/null defaults so
	// the page template can render without conditional null-checks.
	const { data: statsData } = await locals.supabase.rpc('get_cafe_personalised_average', {
		p_cafe_id: params.id
	});
	const statsRow = Array.isArray(statsData) && statsData.length > 0 ? statsData[0] : null;
	const stats = {
		avg_rating: statsRow?.avg_rating ?? null,
		num_ratings: Number(statsRow?.num_ratings ?? 0),
		num_raters: Number(statsRow?.num_raters ?? 0)
	};

	// RLS policy "View connected users ratings" filters this down to ratings
	// from users who share at least one group with the caller.
	const { data: ratingRows } = await locals.supabase
		.from('ratings')
		.select('id, rating, visited_at, created_at, user_id, profiles(display_name)')
		.eq('cafe_id', params.id)
		.order('visited_at', { ascending: false });

	const ratings = ((ratingRows ?? []) as RatingRow[]).map((r) => ({
		id: r.id,
		rating: r.rating,
		visited_at: r.visited_at,
		created_at: r.created_at,
		user_id: r.user_id,
		display_name: r.profiles?.display_name ?? 'user'
	}));

	return { cafe, stats, ratings };
};

export const actions: Actions = {
	submitRating: async ({ locals, params, request, url }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
		}

		const form = await request.formData();
		const validation = validateRatingInput(form.get('rating'), form.get('visited_at'));
		if (!validation.ok) {
			return fail(400, { error: validation.error });
		}

		// IMPORTANT: user_id comes from the session, never from form data. RLS
		// policy "Insert own ratings" has `with check (user_id = auth.uid())`
		// so a mismatch would fail the insert, but we don't even give the
		// client the chance.
		const { error: insError } = await locals.supabase.from('ratings').insert({
			cafe_id: params.id,
			user_id: user.id,
			rating: validation.rating,
			visited_at: validation.visited_at
		});

		if (insError) {
			return fail(500, { error: 'Could not save your rating. Please try again.' });
		}

		return { success: true };
	}
};
