import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { _PAGE_SIZE } from '../+page.server';

// Matches an ISO 8601 timestamp with milliseconds + Z, which is exactly what
// Postgres emits for timestamptz via PostgREST and what we feed back in as a
// cursor. Rejecting anything else prevents malformed input from reaching the
// DB at all -- Postgres would reject it too, but a clean 400 here avoids a
// noisy 500 and stops any future logging/alerting noise.
const ISO_CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

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

export const GET: RequestHandler = async ({ locals, url }) => {
	// Auth guard is enforced here rather than relying on the caller being
	// same-origin: a determined attacker can forge referers, but not a valid
	// session cookie. RLS is still the backstop.
	const { session } = await locals.safeGetSession();
	if (!session) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const rawCursor = url.searchParams.get('cursor');
	let cursor: string | undefined;
	if (rawCursor !== null && rawCursor !== '') {
		if (!ISO_CURSOR.test(rawCursor)) {
			return json({ error: 'Invalid cursor' }, { status: 400 });
		}
		cursor = rawCursor;
	}

	const { data, error: rpcErr } = await locals.supabase.rpc('get_activity_feed', {
		p_limit: _PAGE_SIZE,
		// Omitted when cursor is undefined; PostgREST maps absent params to
		// SQL NULL, which is the "start at newest" branch in the RPC.
		p_cursor: cursor
	});

	if (rpcErr) {
		// Swallow the DB error message -- never echo sensitive details back
		// to the client.
		return json({ error: 'Could not load feed' }, { status: 500 });
	}

	const items = (data ?? []) as FeedItem[];
	const nextCursor = items.length > 0 ? items[items.length - 1].created_at : null;

	return json({ items, nextCursor });
};
