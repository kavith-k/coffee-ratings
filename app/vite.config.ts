import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				// `unit` runs in Node with no external services. Use it for mocked
				// load functions, form actions, and pure utilities. Matches any
				// `*.test.ts` / `*.spec.ts` that is NOT a browser-mounted Svelte
				// component test (`.svelte.test.ts`) and NOT an integration test
				// (`.integration.test.ts` -- those need local Supabase running).
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: [
						'src/**/*.svelte.{test,spec}.{js,ts}',
						'src/**/*.integration.{test,spec}.{js,ts}'
					]
				}
			},

			{
				// `integration` hits the running local Supabase (`supabase start`
				// must be up). Scoped narrowly to `*.integration.test.ts` so unit
				// runs never require the database. These tests share a single
				// local DB, so do not run this project concurrently with itself.
				//
				// `setupFiles` loads .env.test into process.env BEFORE the test
				// modules are imported, so the non-VITE-prefixed service role
				// key stays out of Vite's `import.meta.env` (and therefore out
				// of any bundled code).
				extends: './vite.config.ts',
				test: {
					name: 'integration',
					environment: 'node',
					include: ['src/**/*.integration.{test,spec}.{js,ts}'],
					setupFiles: ['src/lib/supabase/integration-test-setup.ts']
				}
			}
		]
	}
});
