import type { Mock } from 'vitest';

/**
 * Wraps a vitest mock as a SvelteKit remote-query stub. Calling the returned
 * function yields an object shaped like a remote query: `refresh()` invokes
 * the mock with the original arguments and stores the value in `current`,
 * and awaiting the object directly resolves with the mock's value. This keeps
 * components testable that force-refresh cached queries after mutations.
 */
export function remoteQueryStub(fn: Mock) {
	return (...args: unknown[]) => {
		const stub = {
			current: undefined as unknown,
			refresh: async () => {
				stub.current = await fn(...args);
			},
			then: (
				onFulfilled?: (value: unknown) => unknown,
				onRejected?: (reason: unknown) => unknown
			) =>
				Promise.resolve()
					.then(() => fn(...args))
					.then(onFulfilled, onRejected)
		};
		return stub;
	};
}
