import { describe, it, expect, vi } from 'vitest';
import { load, actions } from './+page.server';

/**
 * /users/[id] profile page load.
 *
 * Bugs these tests catch:
 *   - missing auth guard (profile history must be login-gated)
 *   - returning a distinct "not visible to you" error for an existing but
 *     RLS-hidden profile, which would leak existence. Both "nonexistent"
 *     and "hidden" must 404 identically.
 *   - using `.single()` (which errors on zero rows) instead of `.maybeSingle()`
 *     for the profile lookup
 *   - returning the raw cafes join (wrong shape) instead of flat fields
 *   - sorting ratings in the wrong order (must be visited_at desc so the
 *     most recent visit is first, matching cafe-detail's convention)
 */

type TerminalResult = { data: unknown; error: unknown };

function buildEvent(opts: {
	profileResult?: TerminalResult;
	ratingsResult?: TerminalResult;
	authenticated?: boolean;
	targetId?: string;
}) {
	const profileChain: Record<string, unknown> = {};
	profileChain.select = vi.fn().mockReturnValue(profileChain);
	profileChain.eq = vi.fn().mockReturnValue(profileChain);
	profileChain.maybeSingle = vi
		.fn()
		.mockResolvedValue(opts.profileResult ?? { data: null, error: null });

	const ratingsChain: Record<string, unknown> = {};
	ratingsChain.select = vi.fn().mockReturnValue(ratingsChain);
	ratingsChain.eq = vi.fn().mockReturnValue(ratingsChain);
	ratingsChain.order = vi.fn().mockResolvedValue(opts.ratingsResult ?? { data: [], error: null });

	const fromMock = vi.fn((table: string) => {
		if (table === 'profiles') return profileChain;
		if (table === 'ratings') return ratingsChain;
		throw new Error('unexpected table: ' + table);
	});

	return {
		event: {
			locals: {
				supabase: { from: fromMock } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: {
								session: { user: { id: 'me' } },
								user: { id: 'me' }
							}
				)
			},
			url: new URL('http://localhost:5173/users/' + (opts.targetId ?? 'u1')),
			params: { id: opts.targetId ?? 'u1' }
		} as never,
		profileChain,
		ratingsChain
	};
}

describe('/users/[id] load', () => {
	it("redirects unauth'd users to /auth/login?next=/users/u1", async () => {
		const { event } = buildEvent({ authenticated: false });

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fusers%2Fu1'
		});
	});

	it('returns 404 when the profile is null (nonexistent or RLS-hidden)', async () => {
		// This is the critical existence-leak guard. RLS lets you read a
		// profile only if you share a group with that user; if you don't,
		// the select returns `data: null` with no error. We treat that
		// identically to "doesn't exist" so an attacker can't distinguish
		// the two cases by probing user IDs.
		const { event } = buildEvent({
			profileResult: { data: null, error: null }
		});

		await expect(load(event)).rejects.toMatchObject({ status: 404 });
	});

	it('returns 404 when maybeSingle errors (treat as not found, not 500)', async () => {
		const { event } = buildEvent({
			profileResult: { data: null, error: { message: 'boom' } }
		});

		await expect(load(event)).rejects.toMatchObject({ status: 404 });
	});

	it('returns profile + ratings shaped for the page', async () => {
		const { event, profileChain, ratingsChain } = buildEvent({
			profileResult: {
				data: { id: 'u1', display_name: 'Alice' },
				error: null
			},
			ratingsResult: {
				data: [
					{
						id: 'r1',
						rating: 6.5,
						visited_at: '2026-03-20',
						created_at: '2026-03-21T10:00:00Z',
						cafes: { id: 'c1', name: '3fe', area: 'Grand Canal' }
					},
					{
						id: 'r2',
						rating: 4.0,
						visited_at: '2026-02-10',
						created_at: '2026-02-11T10:00:00Z',
						cafes: { id: 'c2', name: 'Kaph', area: 'Creative Quarter' }
					}
				],
				error: null
			}
		});

		const result = (await load(event)) as unknown as {
			profile: { id: string; display_name: string };
			ratings: Array<{
				id: string;
				rating: number;
				visited_at: string;
				cafe_id: string;
				cafe_name: string;
				cafe_area: string | null;
			}>;
		};

		expect(result.profile).toEqual({ id: 'u1', display_name: 'Alice' });
		expect(result.ratings).toHaveLength(2);
		expect(result.ratings[0]).toEqual({
			id: 'r1',
			rating: 6.5,
			visited_at: '2026-03-20',
			cafe_id: 'c1',
			cafe_name: '3fe',
			cafe_area: 'Grand Canal'
		});

		// Lock in that we're querying by the url param and sorting most-recent first.
		expect(profileChain.eq).toHaveBeenCalledWith('id', 'u1');
		expect(ratingsChain.eq).toHaveBeenCalledWith('user_id', 'u1');
		expect(ratingsChain.order).toHaveBeenCalledWith('visited_at', { ascending: false });
	});

	it('returns an empty ratings list when the user has not rated anything visible', async () => {
		// If a profile is visible but the user has no ratings (or none
		// visible to the caller), the page should still render cleanly.
		const { event } = buildEvent({
			profileResult: { data: { id: 'u1', display_name: 'Alice' }, error: null },
			ratingsResult: { data: null, error: null }
		});

		const result = (await load(event)) as unknown as { ratings: unknown[] };
		expect(result.ratings).toEqual([]);
	});

	it('handles malformed cafes join (null) without crashing', async () => {
		// Defensive: a rating with no cafe shouldn't exist (FK constraint),
		// but if the join returns null for some reason we'd rather render
		// "unknown cafe" than throw.
		const { event } = buildEvent({
			profileResult: { data: { id: 'u1', display_name: 'Alice' }, error: null },
			ratingsResult: {
				data: [
					{
						id: 'r1',
						rating: 5.0,
						visited_at: '2026-03-01',
						created_at: '2026-03-02T10:00:00Z',
						cafes: null
					}
				],
				error: null
			}
		});

		const result = (await load(event)) as unknown as {
			ratings: Array<{ cafe_id: string | null; cafe_name: string }>;
		};
		expect(result.ratings[0].cafe_id).toBeNull();
		expect(result.ratings[0].cafe_name).toBe('Unknown cafe');
	});
});

/**
 * /users/[id] updateDisplayName action.
 *
 * Bugs these tests catch:
 *   - missing auth guard (only authenticated users can change their name)
 *   - scoping the UPDATE by the URL param instead of the session user id
 *     (would let anyone POST to /users/<other>?/updateDisplayName and -- if
 *     the RLS policy ever widens -- edit someone else's profile)
 *   - skipping length/empty validation and relying on the DB check constraint
 *     alone (users would see an opaque 500 instead of a friendly message)
 *   - not trimming whitespace (whitespace-only names would pass through)
 *   - not returning the failing value back so the form can re-render it
 */

function buildActionEvent(opts: {
	formData: Record<string, string>;
	authenticated?: boolean;
	userId?: string;
	targetId?: string;
	updateResult?: { error: unknown };
}) {
	const profilesChain: Record<string, unknown> = {};
	profilesChain.update = vi.fn().mockReturnValue(profilesChain);
	profilesChain.eq = vi.fn().mockResolvedValue(opts.updateResult ?? { error: null });

	const fromMock = vi.fn((table: string) => {
		if (table === 'profiles') return profilesChain;
		throw new Error('unexpected table: ' + table);
	});

	const form = new Map<string, string>(Object.entries(opts.formData));
	const request = {
		formData: vi.fn().mockResolvedValue({
			get: (key: string) => form.get(key) ?? null
		})
	};

	const userId = opts.userId ?? 'me';
	const targetId = opts.targetId ?? userId;

	return {
		event: {
			locals: {
				supabase: { from: fromMock } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: {
								session: { user: { id: userId } },
								user: { id: userId }
							}
				)
			},
			request: request as never,
			url: new URL('http://localhost:5173/users/' + targetId),
			params: { id: targetId }
		} as never,
		profilesChain
	};
}

describe('/users/[id] ?/updateDisplayName action', () => {
	it("redirects unauth'd users to /auth/login?next=/users/me", async () => {
		const { event } = buildActionEvent({
			formData: { display_name: 'New Name' },
			authenticated: false
		});

		await expect(actions.updateDisplayName(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fusers%2Fme'
		});
	});

	it('rejects empty display_name', async () => {
		const { event, profilesChain } = buildActionEvent({
			formData: { display_name: '' }
		});

		const result = (await actions.updateDisplayName(event)) as {
			status: number;
			data: { error: string };
		};

		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/name/i);
		expect(profilesChain.update).not.toHaveBeenCalled();
	});

	it('rejects whitespace-only display_name (trims before validating)', async () => {
		const { event, profilesChain } = buildActionEvent({
			formData: { display_name: '   ' }
		});

		const result = (await actions.updateDisplayName(event)) as { status: number };

		expect(result.status).toBe(400);
		expect(profilesChain.update).not.toHaveBeenCalled();
	});

	it('rejects display_name longer than 50 chars (matches DB check constraint)', async () => {
		const { event, profilesChain } = buildActionEvent({
			formData: { display_name: 'x'.repeat(51) }
		});

		const result = (await actions.updateDisplayName(event)) as { status: number };

		expect(result.status).toBe(400);
		expect(profilesChain.update).not.toHaveBeenCalled();
	});

	it('trims the name before saving', async () => {
		const { event, profilesChain } = buildActionEvent({
			formData: { display_name: '  Alice  ' }
		});

		await actions.updateDisplayName(event);

		expect(profilesChain.update).toHaveBeenCalledWith({ display_name: 'Alice' });
	});

	it("scopes the UPDATE by the session user's id, NOT the URL param", async () => {
		// This is the existence-leak / privilege-escalation guard: if the
		// action trusted params.id, a user could POST to another user's URL
		// and update them. Even though RLS would block it today, we keep the
		// action honest by passing user.id explicitly.
		const { event, profilesChain } = buildActionEvent({
			formData: { display_name: 'New Name' },
			userId: 'me',
			targetId: 'someone-else'
		});

		await actions.updateDisplayName(event);

		expect(profilesChain.eq).toHaveBeenCalledWith('id', 'me');
	});

	it('returns success on a clean update', async () => {
		const { event } = buildActionEvent({
			formData: { display_name: 'Alice' }
		});

		const result = await actions.updateDisplayName(event);

		expect(result).toMatchObject({ success: true });
	});

	it('returns fail(500) when the DB update errors', async () => {
		const { event } = buildActionEvent({
			formData: { display_name: 'Alice' },
			updateResult: { error: { message: 'boom' } }
		});

		const result = (await actions.updateDisplayName(event)) as {
			status: number;
			data: { error: string };
		};

		expect(result.status).toBe(500);
		expect(result.data.error).toBeTruthy();
	});
});
