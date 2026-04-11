import type { HandleClientError } from '@sveltejs/kit';
import { redactError, formatErrorForLog } from '$lib/hooks/redact-error';

export const handleError: HandleClientError = ({ error, event }) => {
	const { message, errorId } = redactError(error, event);
	console.error(formatErrorForLog(error, errorId, event));
	return { message, errorId };
};
