import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}

	// RLS policy "Members can view their groups" scopes this select to groups
	// the user actually belongs to. This is load-bearing: removing that policy
	// (or weakening it to `using (true)`) would leak the entire groups table to
	// every authenticated user. The test in page.server.test.ts locks in the
	// exact query shape; integration tests in db.integration.test.ts lock in
	// the RLS behaviour itself.
	const { data, error } = await locals.supabase
		.from('groups')
		.select('id, name')
		.order('created_at', { ascending: false });

	if (error) {
		throw error;
	}

	return { groups: data ?? [] };
};
