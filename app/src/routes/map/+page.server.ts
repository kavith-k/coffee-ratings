import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}

	const { data: cafeRows, error } = await locals.supabase.rpc(
		'get_personalised_cafe_list',
		{
			p_limit: 500,
			p_offset: 0
		}
	);

	if (error) {
		throw error;
	}

	// Only include rated cafes with valid coordinates. Unrated cafes add noise
	// without value, and null coords would crash Leaflet.
	const cafes = (cafeRows ?? []).filter(
		(c: { lat: number | null; lng: number | null; avg_rating: number | null }) =>
			c.lat !== null && c.lng !== null && c.avg_rating !== null
	);

	return { cafes };
};
