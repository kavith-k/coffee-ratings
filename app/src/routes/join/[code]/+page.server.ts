import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { session } = await locals.safeGetSession();

	if (!session) {
		// Anonymous preview path. Uses the one deliberately-unauthenticated RPC
		// (`get_group_preview_by_invite_code`) which returns only group name +
		// member count. Do not expose any error details to anons -- whether
		// the code is invalid, the RPC threw, or the group simply has no
		// members, we surface the same `groupPreview: null` state and let the
		// page render a generic "invalid link" message.
		const { data, error } = await locals.supabase.rpc('get_group_preview_by_invite_code', {
			code: params.code
		});

		const preview =
			!error && Array.isArray(data) && data.length > 0 ? (data[0] as { name: string; member_count: number }) : null;

		return {
			authenticated: false as const,
			inviteCode: params.code,
			groupPreview: preview
		};
	}

	// Authenticated path: run the join RPC. It is idempotent (re-joining as an
	// existing member returns the group id without error), so we can always
	// redirect on success regardless of membership status.
	const { data: groupId, error } = await locals.supabase.rpc('join_group_by_invite_code', {
		code: params.code
	});

	if (error || !groupId) {
		// Map ANY RPC error to a single generic user-facing string. Never leak
		// the raw Postgres exception text to the browser.
		return {
			authenticated: true as const,
			error: 'Invalid or expired invite link'
		};
	}

	redirect(303, '/groups/' + groupId);
};
