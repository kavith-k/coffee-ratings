import { describe, it, expect, vi } from 'vitest';
import { load, actions } from './+page.server';

/**
 * /cafes/[id] detail page load. Bugs these tests catch:
 *   - returning 500 instead of 404 when the cafe doesn't exist
 *   - calling get_cafe_personalised_average with the wrong param name
 *   - forgetting to default stats when the RPC returns an empty array (no
 *     visible users -> no ratings -> nulls); the page should still render
 *   - returning raw profile joins with the wrong shape (would crash the
 *     page template when it tries to access display_name)
 */

type TerminalResult = { data: unknown; error: unknown };

function buildEvent(opts: {
	cafeResult: TerminalResult;
	statsResult: TerminalResult;
	ratingsResult: TerminalResult;
	authenticated?: boolean;
}) {
	const cafeChain: Record<string, unknown> = {};
	cafeChain.select = vi.fn().mockReturnValue(cafeChain);
	cafeChain.eq = vi.fn().mockReturnValue(cafeChain);
	cafeChain.single = vi.fn().mockResolvedValue(opts.cafeResult);

	const ratingsChain: Record<string, unknown> = {};
	ratingsChain.select = vi.fn().mockReturnValue(ratingsChain);
	ratingsChain.eq = vi.fn().mockReturnValue(ratingsChain);
	ratingsChain.order = vi.fn().mockResolvedValue(opts.ratingsResult);

	const fromMock = vi.fn((table: string) => {
		if (table === 'cafes') return cafeChain;
		if (table === 'ratings') return ratingsChain;
		throw new Error('unexpected table ' + table);
	});
	const rpcMock = vi.fn().mockResolvedValue(opts.statsResult);

	return {
		event: {
			locals: {
				supabase: { from: fromMock, rpc: rpcMock } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: {
								session: { user: { id: 'u1' } },
								user: { id: 'u1' }
							}
				)
			},
			url: new URL('http://localhost:5173/cafes/cafe-1'),
			params: { id: 'cafe-1' }
		} as never,
		rpcMock,
		cafeChain,
		ratingsChain
	};
}

describe('/cafes/[id] load', () => {
	it("redirects unauth'd users to /auth/login", async () => {
		const { event } = buildEvent({
			authenticated: false,
			cafeResult: { data: null, error: null },
			statsResult: { data: [], error: null },
			ratingsResult: { data: [], error: null }
		});

		await expect(load(event)).rejects.toMatchObject({ status: 303 });
	});

	it('returns 404 when the cafe does not exist', async () => {
		const { event } = buildEvent({
			cafeResult: { data: null, error: { code: 'PGRST116' } },
			statsResult: { data: [], error: null },
			ratingsResult: { data: [], error: null }
		});

		await expect(load(event)).rejects.toMatchObject({ status: 404 });
	});

	it('returns cafe, stats, and ratings shaped for the page', async () => {
		const { event, rpcMock, cafeChain, ratingsChain } = buildEvent({
			cafeResult: {
				data: {
					id: 'cafe-1',
					name: 'Third Place',
					area: 'Phibsborough',
					lat: 53.3,
					lng: -6.3
				},
				error: null
			},
			statsResult: {
				data: [{ avg_rating: 6.2, num_ratings: 5, num_raters: 3 }],
				error: null
			},
			ratingsResult: {
				data: [
					{
						id: 'r1',
						rating: 6.5,
						visited_at: '2026-03-01',
						created_at: '2026-03-02T10:00:00Z',
						user_id: 'u1',
						profiles: { display_name: 'Alice' }
					}
				],
				error: null
			}
		});

		const result = (await load(event)) as unknown as {
			cafe: { id: string; name: string; area: string };
			stats: { avg_rating: number; num_ratings: number; num_raters: number };
			ratings: Array<{ id: string; rating: number; display_name: string; user_id: string }>;
		};

		expect(result.cafe.name).toBe('Third Place');
		expect(result.stats).toEqual({ avg_rating: 6.2, num_ratings: 5, num_raters: 3 });
		expect(result.ratings).toHaveLength(1);
		expect(result.ratings[0]).toMatchObject({
			rating: 6.5,
			display_name: 'Alice',
			user_id: 'u1'
		});

		expect(rpcMock).toHaveBeenCalledWith('get_cafe_personalised_average', {
			p_cafe_id: 'cafe-1'
		});
		expect(cafeChain.eq).toHaveBeenCalledWith('id', 'cafe-1');
		expect(ratingsChain.order).toHaveBeenCalledWith('visited_at', { ascending: false });
	});

	// ---- submitRating action tests ----
	// Bugs these catch:
	//   - accepting `user_id` from the form body (would let a user rate as
	//     someone else if the RLS check were ever relaxed)
	//   - accepting out-of-range ratings that would 500 at the DB
	//   - accepting rating values with more than one decimal place
	//   - accepting future visited_at dates (doesn't make sense)
	//   - accepting non-numeric or missing rating

	it('returns sensible defaults when the RPC returns no stats row', async () => {
		// Happens when a cafe has no ratings visible to the caller. Page must
		// still render (no ratings list + "no average yet" state).
		const { event } = buildEvent({
			cafeResult: {
				data: { id: 'cafe-1', name: 'Third Place', area: 'Phibsborough', lat: null, lng: null },
				error: null
			},
			statsResult: { data: [], error: null },
			ratingsResult: { data: [], error: null }
		});

		const result = (await load(event)) as unknown as {
			stats: { avg_rating: number | null; num_ratings: number; num_raters: number };
		};

		expect(result.stats.avg_rating).toBeNull();
		expect(result.stats.num_ratings).toBe(0);
		expect(result.stats.num_raters).toBe(0);
	});
});

// ---- submitRating action ----

function buildRatingActionEvent(opts: {
	body: Record<string, string>;
	userId?: string;
	insertResult?: { data: unknown; error: unknown };
}) {
	const terminal = opts.insertResult ?? { data: null, error: null };
	const insertChain: Record<string, unknown> = {};
	insertChain.then = (onFulfilled: (v: unknown) => unknown) =>
		Promise.resolve(terminal).then(onFulfilled);
	const insertFn = vi.fn().mockReturnValue(insertChain);
	const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

	const formData = new URLSearchParams();
	for (const [k, v] of Object.entries(opts.body)) formData.set(k, v);

	return {
		event: {
			locals: {
				supabase: { from: fromFn } as never,
				safeGetSession: vi.fn().mockResolvedValue({
					session: { user: { id: opts.userId ?? 'rater-id' } },
					user: { id: opts.userId ?? 'rater-id' }
				})
			},
			url: new URL('http://localhost:5173/cafes/cafe-1'),
			params: { id: 'cafe-1' },
			request: new Request('http://localhost:5173/cafes/cafe-1', {
				method: 'POST',
				body: formData
			})
		} as never,
		insertFn,
		fromFn
	};
}

describe('/cafes/[id] submitRating action', () => {
	it('inserts a rating with user_id from session and returns success', async () => {
		const { event, insertFn, fromFn } = buildRatingActionEvent({
			body: { rating: '6.5', visited_at: '2026-03-01' }
		});

		const result = (await actions.submitRating(event)) as { success: boolean };

		expect(result.success).toBe(true);
		expect(fromFn).toHaveBeenCalledWith('ratings');
		expect(insertFn).toHaveBeenCalledTimes(1);
		const inserted = insertFn.mock.calls[0][0] as Record<string, unknown>;
		expect(inserted).toEqual({
			cafe_id: 'cafe-1',
			user_id: 'rater-id',
			rating: 6.5,
			visited_at: '2026-03-01'
		});
	});

	it('ignores user_id from the form body (never trust the client)', async () => {
		const { event, insertFn } = buildRatingActionEvent({
			body: { rating: '5.0', visited_at: '2026-03-01', user_id: 'someone-else' }
		});
		await actions.submitRating(event);
		const inserted = insertFn.mock.calls[0][0] as Record<string, unknown>;
		expect(inserted.user_id).toBe('rater-id');
	});

	it('rejects ratings below 0', async () => {
		const { event, insertFn } = buildRatingActionEvent({
			body: { rating: '-0.5', visited_at: '2026-03-01' }
		});
		const result = (await actions.submitRating(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('rejects ratings above 7', async () => {
		const { event, insertFn } = buildRatingActionEvent({
			body: { rating: '7.1', visited_at: '2026-03-01' }
		});
		const result = (await actions.submitRating(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('rejects ratings with more than one decimal place', async () => {
		const { event, insertFn } = buildRatingActionEvent({
			body: { rating: '5.55', visited_at: '2026-03-01' }
		});
		const result = (await actions.submitRating(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('rejects non-numeric ratings', async () => {
		const { event, insertFn } = buildRatingActionEvent({
			body: { rating: 'lol', visited_at: '2026-03-01' }
		});
		const result = (await actions.submitRating(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('rejects future visit dates', async () => {
		const futureDate = '2099-01-01';
		const { event, insertFn } = buildRatingActionEvent({
			body: { rating: '6.0', visited_at: futureDate }
		});
		const result = (await actions.submitRating(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('rejects missing visit dates', async () => {
		const { event, insertFn } = buildRatingActionEvent({
			body: { rating: '6.0' }
		});
		const result = (await actions.submitRating(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('maps insert errors to a friendly failure', async () => {
		const { event } = buildRatingActionEvent({
			body: { rating: '6.0', visited_at: '2026-03-01' },
			insertResult: { data: null, error: { message: 'some postgres detail' } }
		});
		const result = (await actions.submitRating(event)) as { status: number; data: { error: string } };
		expect(result.status).toBe(500);
		expect(result.data.error).not.toMatch(/postgres/i);
	});
});
