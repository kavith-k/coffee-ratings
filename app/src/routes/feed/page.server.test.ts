import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server';

/**
 * /feed initial load. Only the first page of ~20 items comes through here;
 * subsequent pages are fetched client-side via /feed/items (see
 * feed/items/server.test.ts).
 *
 * Bugs these tests catch:
 *   - missing auth guard
 *   - calling get_activity_feed with the wrong param name (p_cursor vs cursor)
 *   - calling with a non-null cursor on the initial load (would skip items)
 *   - forgetting to derive nextCursor from the last item's created_at, which
 *     breaks pagination (client would never get a second page)
 *   - incorrect hasMore signalling when the feed is exactly empty
 */

type TerminalResult = { data: unknown; error: unknown };

function buildEvent(opts: { feedResult?: TerminalResult; authenticated?: boolean }) {
	const rpcMock = vi.fn().mockResolvedValue(opts.feedResult ?? { data: [], error: null });

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
			url: new URL('http://localhost:5173/feed')
		} as never,
		rpcMock
	};
}

describe('/feed load', () => {
	it("redirects unauth'd users to /auth/login?next=/feed", async () => {
		const { event } = buildEvent({ authenticated: false });

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Ffeed'
		});
	});

	it('calls get_activity_feed with default page size and no cursor', async () => {
		const { event, rpcMock } = buildEvent({});

		await load(event);

		// p_cursor is omitted (PostgREST maps absent params to SQL NULL,
		// which is the "start at newest" branch in the RPC). Generated
		// RPC types model p_cursor as `string | undefined`, not nullable.
		expect(rpcMock).toHaveBeenCalledWith('get_activity_feed', {
			p_limit: 20
		});
	});

	it('returns items + nextCursor derived from the last item', async () => {
		const feed = [
			{
				rating_id: 'r1',
				user_id: 'u1',
				display_name: 'Alice',
				cafe_id: 'c1',
				cafe_name: '3fe',
				area: 'Grand Canal',
				rating: 6.5,
				visited_at: '2026-04-09',
				created_at: '2026-04-10T12:00:00Z'
			},
			{
				rating_id: 'r2',
				user_id: 'u2',
				display_name: 'Bob',
				cafe_id: 'c2',
				cafe_name: 'Kaph',
				area: 'Creative Quarter',
				rating: 5.0,
				visited_at: '2026-04-08',
				created_at: '2026-04-09T12:00:00Z'
			}
		];
		const { event } = buildEvent({ feedResult: { data: feed, error: null } });

		const result = (await load(event)) as unknown as {
			items: typeof feed;
			nextCursor: string | null;
		};

		expect(result.items).toEqual(feed);
		// Cursor is the oldest item in this page -- the next page should
		// fetch items older than this timestamp.
		expect(result.nextCursor).toBe('2026-04-09T12:00:00Z');
	});

	it('returns nextCursor=null when the feed is empty (no more to load)', async () => {
		const { event } = buildEvent({ feedResult: { data: [], error: null } });

		const result = (await load(event)) as unknown as {
			items: unknown[];
			nextCursor: string | null;
		};

		expect(result.items).toEqual([]);
		expect(result.nextCursor).toBeNull();
	});

	it('throws when the RPC errors', async () => {
		const { event } = buildEvent({
			feedResult: { data: null, error: { message: 'boom' } }
		});

		await expect(load(event)).rejects.toBeTruthy();
	});
});
