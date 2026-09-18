import { error } from '@sveltejs/kit';

/**
 * A resolved command call: awaitable directly and via `.updates(...)`, the
 * way a remote `command` returns.
 * @param value - What the command resolves to.
 */
export function commandResult<T>(value: T): Promise<T> & { updates: () => Promise<T> } {
	const promise = Promise.resolve(value);
	return Object.assign(promise, { updates: () => promise });
}

/**
 * A rejected command call with the same shape as `commandResult`.
 * @param err - The rejection value.
 */
export function commandFailure(err: unknown): Promise<never> & { updates: () => Promise<never> } {
	const promise = Promise.reject(err);
	promise.catch(() => undefined);
	return Object.assign(promise, { updates: () => promise });
}

/**
 * Builds a Kit HttpError the way a remote function's `error()` call does.
 * @param status - HTTP status.
 * @param message - Error message.
 */
export function httpError(status: number, message: string): unknown {
	try {
		error(status, message);
	} catch (e) {
		return e;
	}
	return null;
}
