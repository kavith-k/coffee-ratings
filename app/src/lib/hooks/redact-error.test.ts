import { describe, expect, it } from 'vitest';
import { redactError, formatErrorForLog } from './redact-error';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

describe('redactError', () => {
	it('replaces a raw Error message with a generic message and returns an errorId', () => {
		// Regression guard: raw database errors (e.g. "Database connection refused",
		// Postgres auth failures, connection strings) must never reach the rendered
		// error page. The helper is the single chokepoint for that redaction.
		const error = new Error('Database connection refused');
		const result = redactError(error);

		expect(result.message).toBe(GENERIC_MESSAGE);
		expect(result.message).not.toContain('Database');
		expect(JSON.stringify(result)).not.toContain('Database connection refused');
		expect(typeof result.errorId).toBe('string');
		expect(result.errorId.length).toBeGreaterThan(0);
	});

	it('returns the generic payload when a string is thrown', () => {
		// Regression guard: JavaScript permits `throw 'oops'`. A naive
		// implementation that only handled `instanceof Error` would pass the
		// raw string through untouched.
		const result = redactError('raw string with sensitive detail');

		expect(result.message).toBe(GENERIC_MESSAGE);
		expect(JSON.stringify(result)).not.toContain('sensitive detail');
	});

	it('never passes through a .message property on an arbitrary object', () => {
		// Regression guard: Supabase/PostgREST errors arrive as plain objects with
		// a .message field exposing RLS policy names and table names. Forwarding
		// that field would leak the authorisation model to anyone hitting an
		// error page.
		const postgrestLike = {
			message: 'PostgrestError: permission denied for table ratings',
			code: '42501'
		};
		const result = redactError(postgrestLike);

		expect(result.message).toBe(GENERIC_MESSAGE);
		expect(JSON.stringify(result)).not.toContain('permission denied');
		expect(JSON.stringify(result)).not.toContain('ratings');
	});

	it('generates a fresh errorId of at least 8 characters on each call', () => {
		// Regression guard: a constant or empty errorId would defeat the
		// "report this id" flow -- users could not distinguish one incident
		// from another in the server logs.
		const a = redactError(new Error('one'));
		const b = redactError(new Error('two'));

		expect(a.errorId.length).toBeGreaterThanOrEqual(8);
		expect(b.errorId.length).toBeGreaterThanOrEqual(8);
		expect(a.errorId).not.toBe(b.errorId);
	});
});

describe('formatErrorForLog', () => {
	it('includes the raw Error message, the errorId, and the request path', () => {
		// Regression guard: the whole point of splitting redactError and
		// formatErrorForLog is that the server log retains the underlying
		// cause. A refactor that accidentally logged only the generic
		// message would make production incidents undebuggable.
		const errorId = 'abcd1234';
		const event = { url: new URL('https://example.com/groups/42') };
		const out = formatErrorForLog(new Error('boom'), errorId, event);

		expect(out).toContain('boom');
		expect(out).toContain(errorId);
		expect(out).toContain('/groups/42');
	});

	it('still renders a useful log line when no event is supplied', () => {
		// Regression guard: client-side handleError may be called without a
		// navigation event; the formatter must not crash and must still log
		// the underlying message.
		const out = formatErrorForLog(new Error('kapow'), 'id-xyz-1');

		expect(out).toContain('kapow');
		expect(out).toContain('id-xyz-1');
	});

	it('logs a string error verbatim', () => {
		// Regression guard: if we JSON.stringify a string we get wrapped
		// quotes which are noisy in logs. Keep the raw string.
		const out = formatErrorForLog('just a string', 'id-1');

		expect(out).toContain('just a string');
	});
});
