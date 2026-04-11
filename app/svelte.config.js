import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		// Content Security Policy: baseline hardening against XSS. SvelteKit injects
		// nonces/hashes automatically for its own inline scripts and styles.
		//
		// NOTE: `connect-src` must list every Supabase project you deploy against
		// (PostgREST for HTTPS, Realtime for WSS). The wildcard covers hosted
		// projects; the localhost entries are for `supabase start` during dev.
		// When you wire up Leaflet, widen `img-src` to the tile provider you pick.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ["'self'"],
				'script-src': ["'self'"],
				'style-src': ["'self'", "'unsafe-inline'"],
				'img-src': ["'self'", 'data:', 'blob:'],
				'font-src': ["'self'", 'data:'],
				'connect-src': [
					"'self'",
					'https://*.supabase.co',
					'wss://*.supabase.co',
					'http://127.0.0.1:54321',
					'ws://127.0.0.1:54321'
				],
				'frame-ancestors': ["'none'"],
				'base-uri': ["'self'"],
				'form-action': ["'self'"],
				'object-src': ["'none'"]
			}
		}
	}
};

export default config;
