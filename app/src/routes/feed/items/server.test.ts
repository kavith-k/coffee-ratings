import { describe, it, expect, vi } from 'vitest';
import { GET } from './+server';

/**
 * /feed/items GET endpoint for infinite-scroll pagination.
 *
 * Bugs these tests catch:
 *   - missing auth guard (endpoint must 401 unauth'd, not fall through to RPC)
 *   - passing a user-controlled cursor string to the RPC without validating
 *     it as an ISO timestamp. Even though Postgres would reject malformed
 *     values, we want a clean 400 rather than a 500 from the DB.
 *   - forgetting to derive nextCursor on the subsequent pages
 *   - leaking internal error details back to the client
 */

type TerminalResult = { data: unknown; error: unknown };

function buildEvent(opts: {
	feedResult?: TerminalResult;
	authenticated?: boolean;
	cursor?: string | null;
}) {
	const rpcMock = vi.fn().mockResolvedValue(opts.feedResult ?? { data: [], error: null });

	const searchParams = new URLSearchParams();
	if (opts.cursor !== undefined && opts.cursor !== null) {
		searchParams.set('cursor', opts.cursor);
	}

	return {
		event: {
			locals: {
				supabase: { rpc: rpcMock } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: {
								session: { user: { id: 'me' } },
								user: { id: 'me' }
							}
				)
			},
			url: new URL(
				'http://localhost:5173/feed/items' +
					(searchParams.toString() ? '?' + searchParams.toString() : '')
			)
		} as never,
		rpcMock
	};
}

describe('GET /feed/items', () => {
	it("401s when unauth'd (never falls through to the RPC)", async () => {
		const { event, rpcMock } = buildEvent({ authenticated: false });

		const response = await GET(event);
		expect(response.status).toBe(401);
		expect(rpcMock).not.toHaveBeenCalled();
	});

	it('400s on a malformed cursor value', async () => {
		const { event, rpcMock } = buildEvent({ cursor: 'not-a-timestamp' });

		const response = await GET(event);
		expect(response.status).toBe(400);
		// Importantly, do NOT let the caller's malformed input reach the DB.
		expect(rpcMock).not.toHaveBeenCalled();
	});

	it('calls RPC with the cursor and returns items + nextCursor', async () => {
		const items = [
			{
				rating_id: 'r3',
				user_id: 'u3',
				display_name: 'Carol',
				cafe_id: 'c3',
				cafe_name: 'Vice',
				area: 'Phibsborough',
				rating: 5.8,
				visited_at: '2026-04-05',
				created_at: '2026-04-06T12:00:00Z'
			}
		];
		const { event, rpcMock } = buildEvent({
			cursor: '2026-04-08T00:00:00Z',
			feedResult: { data: items, error: null }
		});

		const response = await GET(event);
		expect(response.status).toBe(200);
		const body = await response.json();

		expect(rpcMock).toHaveBeenCalledWith(
			'get_activity_feed',
			expect.objectContaining({
				p_limit: 20,
				p_cursor: '2026-04-08T00:00:00Z'
			})
		);
		expect(body.items).toEqual(items);
		expect(body.nextCursor).toBe('2026-04-06T12:00:00Z');
	});

	it('returns nextCursor=null when the page is empty (end of feed)', async () => {
		const { event } = buildEvent({
			cursor: '2026-04-08T00:00:00Z',
			feedResult: { data: [], error: null }
		});

		const response = await GET(event);
		const body = await response.json();

		expect(body.items).toEqual([]);
		expect(body.nextCursor).toBeNull();
	});

	it('allows an omitted cursor (treats as initial page)', async () => {
		const { event, rpcMock } = buildEvent({});

		const response = await GET(event);
		expect(response.status).toBe(200);
		// p_cursor is undefined -- PostgREST omits it from the request
		// body, which the RPC interprets as SQL NULL (= no cursor).
		expect(rpcMock).toHaveBeenCalledWith(
			'get_activity_feed',
			expect.objectContaining({ p_limit: 20, p_cursor: undefined })
		);
	});

	it('returns a generic 500 when the RPC fails (never leaks the DB error)', async () => {
		const { event } = buildEvent({
			feedResult: { data: null, error: { message: 'sensitive postgres detail' } }
		});

		const response = await GET(event);
		expect(response.status).toBe(500);
		const body = await response.json();
		expect(JSON.stringify(body)).not.toMatch(/postgres/i);
		expect(JSON.stringify(body)).not.toMatch(/sensitive/i);
	});
});
