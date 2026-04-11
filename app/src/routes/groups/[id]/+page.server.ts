import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type MemberRow = {
	user_id: string;
	role: string; // widened from the DB `check (role in ('admin','member'))`; narrowed on read
	profiles: { display_name: string } | null;
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(url.pathname));
	}

	// RLS policy "Members can view their groups" filters non-members out.
	// A non-member looks like "row not found" (PGRST116). Treat both the
	// error code and a null row as 404 -- never leak existence.
	const { data: group, error: groupError } = await locals.supabase
		.from('groups')
		.select('id, name, invite_code, created_by')
		.eq('id', params.id)
		.single();

	if (groupError || !group) {
		error(404, 'Group not found');
	}

	// RLS policy "View fellow group members" scopes this to members the
	// caller can see (which, because the caller is a member, is everyone in
	// the same group).
	const { data: memberRows } = await locals.supabase
		.from('group_members')
		.select('user_id, role, profiles(display_name)')
		.eq('group_id', params.id);

	const members = ((memberRows ?? []) as MemberRow[]).map((m) => ({
		user_id: m.user_id,
		role: (m.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member',
		display_name: m.profiles?.display_name ?? 'user'
	}));

	const isAdmin = members.find((m) => m.user_id === user.id)?.role === 'admin';

	return {
		group: { id: group.id, name: group.name, created_by: group.created_by },
		members,
		isAdmin,
		inviteCode: group.invite_code
	};
};

async function requireAuth(locals: App.Locals, pathname: string) {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		redirect(303, '/auth/login?next=' + encodeURIComponent(pathname));
	}
	return user;
}

export const actions: Actions = {
	// Admin-only. RLS policy "Admin can delete group" enforces it -- do NOT
	// add a client-side admin check here. If the two were to disagree, the
	// client-side one would be wrong and the DB one would be authoritative,
	// so there's no point having two places to drift.
	deleteGroup: async ({ locals, params, url }) => {
		await requireAuth(locals, url.pathname);

		const { error: delError } = await locals.supabase
			.from('groups')
			.delete()
			.eq('id', params.id);

		if (delError) {
			return fail(500, { error: 'Could not delete group. Please try again.' });
		}

		redirect(303, '/groups');
	},

	// Admin-or-self. RLS policy "Admin or self can remove" enforces it.
	// That policy goes through admin_group_ids() to avoid the inline-subquery
	// recursion that migration 004 fixed -- see supabase/migrations/004.
	removeMember: async ({ locals, request, params, url }) => {
		await requireAuth(locals, url.pathname);

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		if (!userId) {
			return fail(400, { error: 'Missing member to remove.' });
		}

		const { error: delError } = await locals.supabase
			.from('group_members')
			.delete()
			.match({ group_id: params.id, user_id: userId });

		if (delError) {
			return fail(500, { error: 'Could not remove member. Please try again.' });
		}

		return { success: true };
	},

	// Any member can leave. RLS policy "Admin or self can remove" covers the
	// self-case. Admins leaving an empty group orphans it -- the UI hides the
	// leave button for admins as a soft guard; the action itself does not
	// enforce that, matching the current build-doc spec.
	leaveGroup: async ({ locals, params, url }) => {
		const user = await requireAuth(locals, url.pathname);

		const { error: delError } = await locals.supabase
			.from('group_members')
			.delete()
			.match({ group_id: params.id, user_id: user.id });

		if (delError) {
			return fail(500, { error: 'Could not leave group. Please try again.' });
		}

		redirect(303, '/groups');
	}
};
