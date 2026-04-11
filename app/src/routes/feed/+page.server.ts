import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Prefixed with `_` because SvelteKit only permits a fixed set of named
// exports from +page.server.ts (load, actions, prerender, ...). The prefix
// tells the framework to ignore this symbol while still letting the items
// endpoint import it so both pages agree on the page size.
export const _PAGE_SIZE = 20;

type FeedItem = {
	rating_id: string;
	user_id: string;
	display_name: string;
	cafe_id: string;
	cafe_name: string;
	area: string | null;
	rating: number;
	visited_at: string;
	created_at: string;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}

	// get_activity_feed is `security definer` and scopes to visible_user_ids().
	// Initial page always uses p_cursor=null; subsequent pages come through
	// /feed/items/+server.ts with the last item's created_at as the cursor.
	const { data, error: rpcErr } = await locals.supabase.rpc('get_activity_feed', {
		p_limit: _PAGE_SIZE
		// Intentionally omit p_cursor -- generated types model it as
		// `string | undefined`, and PostgREST maps absent params to SQL NULL,
		// which is the "start at the newest item" case.
	});

	if (rpcErr) {
		throw rpcErr;
	}

	const items = (data ?? []) as FeedItem[];
	const nextCursor = items.length > 0 ? items[items.length - 1].created_at : null;

	return { items, nextCursor };
};
