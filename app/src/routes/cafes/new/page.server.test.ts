import { describe, it, expect, vi } from 'vitest';
import { load, actions } from './+page.server';

/**
 * /cafes/new create-cafe flow. Bugs these tests catch:
 *   - bypassing auth (RLS would stop the insert anyway, but the load guard
 *     prevents anonymous users from even seeing the form)
 *   - accepting `created_by` from the form body (would let a user set another
 *     user's id; RLS with check prevents it but belt-and-braces)
 *   - short-circuiting to /cafes/[id] when existingCafeId is set (so the
 *     autocomplete deduplication actually dedupes)
 *   - inserting a cafe even when geocoding fails (graceful degradation --
 *     we still save the row with null lat/lng instead of 500-ing)
 *   - trimming the name/area (consistent formatting)
 *   - name length bounds (1..200), area length bounds (1..100)
 */

type TerminalResult = { data: unknown; error: unknown };

function insertChain(result: TerminalResult) {
	const node: Record<string, unknown> = {};
	node.select = vi.fn().mockReturnValue(node);
	node.single = vi.fn().mockResolvedValue(result);
	return node;
}

function buildEvent(opts: {
	body: Record<string, string>;
	authenticated?: boolean;
	insertResult?: TerminalResult;
	geocodeImpl?: typeof fetch;
}) {
	const insertResult = opts.insertResult ?? {
		data: { id: 'new-cafe-id' },
		error: null
	};
	const chain = insertChain(insertResult);
	const insertFn = vi.fn().mockReturnValue(chain);
	const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

	const formData = new URLSearchParams();
	for (const [k, v] of Object.entries(opts.body)) formData.set(k, v);

	const fetchImpl =
		opts.geocodeImpl ??
		vi.fn().mockResolvedValue(
			new Response(JSON.stringify([{ lat: '53.3498', lon: '-6.2603' }]), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

	return {
		event: {
			locals: {
				supabase: { from: fromFn } as never,
				safeGetSession: vi.fn().mockResolvedValue(
					opts.authenticated === false
						? { session: null, user: null }
						: {
								session: { user: { id: 'creator-id' } },
								user: { id: 'creator-id' }
							}
				)
			},
			url: new URL('http://localhost:5173/cafes/new'),
			request: new Request('http://localhost:5173/cafes/new', {
				method: 'POST',
				body: formData
			}),
			fetch: fetchImpl
		} as never,
		fromFn,
		insertFn,
		fetchImpl
	};
}

describe('/cafes/new load', () => {
	it("redirects unauth'd users to /auth/login?next=/cafes/new", async () => {
		const event = {
			locals: {
				supabase: {} as never,
				safeGetSession: vi.fn().mockResolvedValue({ session: null, user: null })
			},
			url: new URL('http://localhost:5173/cafes/new')
		} as never;

		await expect(load(event)).rejects.toMatchObject({
			status: 303,
			location: '/auth/login?next=%2Fcafes%2Fnew'
		});
	});
});

describe('/cafes/new default action', () => {
	it('rejects an empty name', async () => {
		const { event, insertFn } = buildEvent({ body: { name: '', area: 'Stoneybatter' } });
		const result = (await actions.default(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('rejects a name longer than 200 characters', async () => {
		const { event, insertFn } = buildEvent({
			body: { name: 'a'.repeat(201), area: 'Stoneybatter' }
		});
		const result = (await actions.default(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('rejects an area longer than 100 characters', async () => {
		const { event, insertFn } = buildEvent({
			body: { name: 'Good Cafe', area: 'a'.repeat(101) }
		});
		const result = (await actions.default(event)) as { status: number };
		expect(result.status).toBe(400);
		expect(insertFn).not.toHaveBeenCalled();
	});

	it('short-circuits to /cafes/[existingCafeId] without inserting or geocoding', async () => {
		const { event, insertFn, fetchImpl } = buildEvent({
			body: { name: 'Duplicate Cafe', area: 'Stoneybatter', existingCafeId: 'existing-1' }
		});

		await expect(actions.default(event)).rejects.toMatchObject({
			status: 303,
			location: '/cafes/existing-1'
		});

		expect(insertFn).not.toHaveBeenCalled();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('geocodes, then inserts with trimmed name/area and the session user id', async () => {
		const { event, insertFn, fetchImpl } = buildEvent({
			body: { name: '  Third Place  ', area: '  Phibsborough  ' }
		});

		await expect(actions.default(event)).rejects.toMatchObject({
			status: 303,
			location: '/cafes/new-cafe-id'
		});

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(insertFn).toHaveBeenCalledTimes(1);
		const insertArg = insertFn.mock.calls[0][0] as Record<string, unknown>;
		expect(insertArg.name).toBe('Third Place');
		expect(insertArg.area).toBe('Phibsborough');
		expect(insertArg.lat).toBe(53.3498);
		expect(insertArg.lng).toBe(-6.2603);
		expect(insertArg.created_by).toBe('creator-id');
	});

	it('ignores `created_by` from the form body (security: cannot impersonate)', async () => {
		const { event, insertFn } = buildEvent({
			body: { name: 'Sneaky Cafe', area: 'D1', created_by: 'other-user-id' }
		});

		await expect(actions.default(event)).rejects.toMatchObject({ status: 303 });

		const insertArg = insertFn.mock.calls[0][0] as Record<string, unknown>;
		expect(insertArg.created_by).toBe('creator-id'); // session user, NOT the form value
	});

	it('still inserts the cafe with null lat/lng when geocoding fails', async () => {
		const failingFetch = vi.fn().mockRejectedValue(new Error('nominatim down'));
		const { event, insertFn } = buildEvent({
			body: { name: 'Cafe with no coords', area: 'Somewhere' },
			geocodeImpl: failingFetch as unknown as typeof fetch
		});

		await expect(actions.default(event)).rejects.toMatchObject({ status: 303 });

		const insertArg = insertFn.mock.calls[0][0] as Record<string, unknown>;
		expect(insertArg.lat).toBeNull();
		expect(insertArg.lng).toBeNull();
	});

	it('maps insert errors to a friendly failure (no raw leak)', async () => {
		const { event } = buildEvent({
			body: { name: 'Good Cafe', area: 'D7' },
			insertResult: { data: null, error: { message: 'unique violation on cafes_pkey' } }
		});

		const result = (await actions.default(event)) as { status: number; data: { error: string } };
		expect(result.status).toBe(500);
		expect(result.data.error).not.toMatch(/unique violation/i);
	});
});
