import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Whitelist of sort_by values accepted by get_personalised_cafe_list. Any
// user-supplied ?sort= value outside this set is silently coerced to the
// default, so an attacker (or a typo) cannot produce an unexpected ordering.
const SORT_OPTIONS = ['avg_rating', 'num_ratings'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
const DEFAULT_SORT: SortOption = 'avg_rating';

function parseSort(raw: string | null): SortOption {
	return SORT_OPTIONS.includes(raw as SortOption) ? (raw as SortOption) : DEFAULT_SORT;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}

	const activeSort = parseSort(url.searchParams.get('sort'));

	// get_personalised_cafe_list is `security definer` and scopes the average
	// to users the caller shares a group with (via visible_user_ids()). This
	// is the load-bearing bit: a direct SELECT on ratings would either leak
	// other users' ratings or be too restrictive. See build-docs/04-rpc-functions.md.
	const { data: cafeRows, error: cafeErr } = await locals.supabase.rpc(
		'get_personalised_cafe_list',
		{
			p_sort_by: activeSort,
			p_limit: 50,
			p_offset: 0
		}
	);

	if (cafeErr) {
		throw cafeErr;
	}

	// Only show cafes that someone in the user's groups has actually rated.
	// Unrated cafes are noise in a recommendations-first home page.
	const ratedCafes = (cafeRows ?? []).filter(
		(c: { avg_rating: number | null }) => c.avg_rating !== null
	);

	return {
		cafes: ratedCafes,
		activeSort
	};
};
