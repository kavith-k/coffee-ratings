// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		// PageData is intentionally left empty -- SvelteKit infers the merged
		// shape from `+layout.ts` (which provides `supabase` + `session`) and
		// `+layout.server.ts` (which provides `session` + `cookies`). Declaring
		// required fields here forces every child `+page.server.ts` load to
		// re-return them, which is wrong.
		interface PageData {}
	}
}

export {};
