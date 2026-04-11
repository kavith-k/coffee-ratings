import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { geocode } from '$lib/utils/geocode';

const MAX_NAME = 200; // cafes.name check constraint (schema 001)
const MAX_AREA = 100; // cafes.area check constraint

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request, url, fetch }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
		}

		const form = await request.formData();

		// Autocomplete short-circuit: if the user picked an existing cafe from
		// the autocomplete suggestions, the form carries that cafe's id and we
		// skip creation entirely. This is the whole deduplication mechanism --
		// server does NOT try to fuzzy-match names on submit.
		const existingCafeId = String(form.get('existingCafeId') ?? '').trim();
		if (existingCafeId) {
			redirect(303, '/cafes/' + existingCafeId);
		}

		const name = String(form.get('name') ?? '').trim();
		const area = String(form.get('area') ?? '').trim();

		if (name.length === 0) {
			return fail(400, { error: 'Please enter a cafe name.', name, area });
		}
		if (name.length > MAX_NAME) {
			return fail(400, {
				error: `Cafe name must be ${MAX_NAME} characters or fewer.`,
				name,
				area
			});
		}
		if (area.length > MAX_AREA) {
			return fail(400, {
				error: `Neighbourhood must be ${MAX_AREA} characters or fewer.`,
				name,
				area
			});
		}

		// Geocode via Nominatim. Graceful degradation: if it fails or finds
		// nothing, we still save the cafe with null lat/lng so the user is not
		// blocked on a third-party dependency.
		const query = area ? `${name}, ${area}, Dublin, Ireland` : `${name}, Dublin, Ireland`;
		const coords = await geocode(query, fetch);

		// IMPORTANT: created_by is set from the session user, never from the
		// form body. RLS policy "Authenticated users can add cafes" has a with
		// check (auth.uid() = created_by) so a mismatched value would fail the
		// insert anyway -- this is defence in depth.
		const { data, error: insError } = await locals.supabase
			.from('cafes')
			.insert({
				name,
				area: area || null,
				lat: coords?.lat ?? null,
				lng: coords?.lng ?? null,
				created_by: user.id
			})
			.select('id')
			.single();

		if (insError || !data) {
			return fail(500, {
				error: 'Could not add cafe. Please try again.',
				name,
				area
			});
		}

		redirect(303, '/cafes/' + data.id);
	}
};
