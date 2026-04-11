import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const nextParam = url.searchParams.get('next');
	// Only allow relative paths to prevent open-redirect via ?next=https://evil.com
	const next = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : '/';

	if (code) {
		await locals.supabase.auth.exchangeCodeForSession(code);
	}

	redirect(303, next);
};
