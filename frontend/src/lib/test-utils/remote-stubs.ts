import { error } from '@sveltejs/kit';

/** What a command call was handed through `.updates(...)`. */
type UpdatesSpy = (...updates: unknown[]) => void;

/** The release function of a stubbed `withOverride`, carrying the update it was built from. */
export type OverrideStub<T> = (() => void) & { update: (current: T) => T };

/**
 * A resolved command call: awaitable directly and via `.updates(...)`, the
 * way a remote `command` returns.
 * @param value - What the command resolves to.
 * @param onUpdates - Receives what the caller handed to `.updates(...)`.
 */
export function commandResult<T>(
	value: T,
	onUpdates?: UpdatesSpy
): Promise<T> & { updates: (...updates: unknown[]) => Promise<T> } {
	const promise = Promise.resolve(value);
	return Object.assign(promise, {
		updates: (...updates: unknown[]) => {
			onUpdates?.(...updates);
			return promise;
		}
	});
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
 * A resolved query call that can also be overridden during a command, the way
 * a remote `query` instance handed to `.updates(...)` is. The override it
 * returns carries its update function, so a test can apply it to the value
 * the command's `.updates(...)` received.
 * @param value - What the query resolves to.
 */
export function queryResult<T>(
	value: T
): Promise<T> & { withOverride: (update: (current: T) => T) => OverrideStub<T> } {
	return Object.assign(Promise.resolve(value), {
		withOverride: (update: (current: T) => T) => Object.assign(() => undefined, { update })
	});
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
