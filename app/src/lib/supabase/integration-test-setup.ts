/**
 * Vitest setup file for the `integration` project. Loads `.env.test` into
 * `process.env` so test code can read non-prefixed vars (like
 * `SUPABASE_SERVICE_ROLE_KEY`) via `process.env` without going through
 * Vite's `import.meta.env`.
 *
 * Why this dance: Vite only exposes env vars prefixed with `VITE_` (or
 * `PUBLIC_`) through `import.meta.env`, and anything exposed that way gets
 * statically bundled into whatever code references it. Service role keys
 * MUST NOT go through that channel -- bundling a real service role key
 * into a client-side file (even accidentally, via a stray import) would be
 * catastrophic. By keeping `SUPABASE_SERVICE_ROLE_KEY` unprefixed and
 * reading it from `process.env`, we guarantee it stays Node-only.
 *
 * The shared Supabase CLI local-dev default key is public, so leaking it
 * locally is harmless, but the naming convention is load-bearing for the
 * day this project points at hosted Supabase.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.test');
const content = readFileSync(envPath, 'utf8');

for (const rawLine of content.split('\n')) {
	const line = rawLine.trim();
	if (!line || line.startsWith('#')) continue;
	const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/i.exec(line);
	if (!match) continue;
	const [, key, value] = match;
	// Strip surrounding quotes if any.
	const unquoted = value.replace(/^['"]|['"]$/g, '');
	if (process.env[key] === undefined) {
		process.env[key] = unquoted;
	}
}
