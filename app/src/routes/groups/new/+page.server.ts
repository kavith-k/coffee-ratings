import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME_LENGTH = 100; // mirrors groups.name check constraint (schema 001)

function requireAuthRedirect(session: unknown, nextPath: string) {
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(nextPath));
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	requireAuthRedirect(session, url.pathname);
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const { session } = await locals.safeGetSession();
		requireAuthRedirect(session, url.pathname);

		const form = await request.formData();
		const rawName = String(form.get('name') ?? '');
		const name = rawName.trim();

		if (name.length === 0) {
			return fail(400, { error: 'Please enter a group name.', name: rawName });
		}
		if (name.length > MAX_NAME_LENGTH) {
			return fail(400, {
				error: `Group name must be ${MAX_NAME_LENGTH} characters or fewer.`,
				name: rawName
			});
		}

		// RPC is the ONLY supported path to create a group -- it atomically
		// inserts the group row and the creator's admin membership. Never
		// replace this with a direct insert: groups + group_members have no
		// insert policies, so direct inserts would fail, and if a well-meaning
		// future contributor added such a policy they would reintroduce the
		// vulnerability fixed in the pre-publish security pass.
		const { data: groupId, error } = await locals.supabase.rpc('create_group', {
			p_name: name
		});

		if (error || !groupId) {
			return fail(500, {
				error: 'Could not create group. Please try again.',
				name: rawName
			});
		}

		redirect(303, '/groups/' + groupId);
	}
};
