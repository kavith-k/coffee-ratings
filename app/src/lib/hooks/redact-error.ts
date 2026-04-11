/**
 * Pure helpers shared by `hooks.server.ts` and `hooks.client.ts` to ensure
 * error payloads surfaced to the UI never contain raw messages, while the
 * server log retains the underlying cause plus a correlation id.
 *
 * The whole app is public on GitHub and heavily vibe-coded, so this is the
 * single chokepoint that keeps Postgres/PostgREST/RLS details out of user
 * facing error pages. Do not bypass it.
 */

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

function generateErrorId(): string {
	const fromCrypto = globalThis.crypto?.randomUUID?.();
	if (typeof fromCrypto === 'string' && fromCrypto.length > 0) {
		return fromCrypto;
	}
	// Fallback for environments without a crypto global. Pad to be sure we
	// always satisfy the 8-character minimum that the UI "report this id"
	// flow depends on.
	const rand = Math.random().toString(36).slice(2);
	const time = Date.now().toString(36);
	return `${time}-${rand}`.padEnd(8, '0');
}

export function redactError(
	_error: unknown,
	_event?: { url: URL } | undefined
): { message: string; errorId: string } {
	return {
		message: GENERIC_MESSAGE,
		errorId: generateErrorId()
	};
}

export function formatErrorForLog(
	error: unknown,
	errorId: string,
	event?: { url?: URL }
): string {
	let raw: string;
	if (error instanceof Error) {
		raw = error.stack ?? error.message;
	} else if (typeof error === 'string') {
		raw = error;
	} else {
		try {
			raw = JSON.stringify(error);
		} catch {
			raw = String(error);
		}
	}

	const path = event?.url?.pathname ?? '<unknown>';
	return `[${errorId}] ${path} -- ${raw}`;
}
