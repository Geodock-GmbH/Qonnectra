import { afterEach, describe, expect, test, vi } from 'vitest';

import { fireBeforeUnload } from '$lib/test-utils/fireBeforeUnload';

import { hasPendingWrites, trackPendingWrite } from './pendingWrites';

/**
 * Creates a promise whose resolution is controlled by the test.
 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('trackPendingWrite', () => {
	test('should resolve with the wrapped promise value', async () => {
		await expect(trackPendingWrite(Promise.resolve('ok'))).resolves.toBe('ok');
	});

	test('should propagate rejections from the wrapped promise', async () => {
		await expect(trackPendingWrite(Promise.reject(new Error('boom')))).rejects.toThrow('boom');
	});

	test('should block beforeunload while a write is pending', async () => {
		const { promise, resolve } = deferred<void>();

		const tracked = trackPendingWrite(promise);
		expect(hasPendingWrites()).toBe(true);
		expect(fireBeforeUnload()).toBe(true);

		resolve();
		await tracked;

		expect(hasPendingWrites()).toBe(false);
		expect(fireBeforeUnload()).toBe(false);
	});

	test('should keep blocking beforeunload until every overlapping write settles', async () => {
		const first = deferred<void>();
		const second = deferred<void>();

		const trackedFirst = trackPendingWrite(first.promise);
		const trackedSecond = trackPendingWrite(second.promise);

		first.resolve();
		await trackedFirst;
		expect(fireBeforeUnload()).toBe(true);

		second.resolve();
		await trackedSecond;
		expect(fireBeforeUnload()).toBe(false);
	});

	test('should stop blocking beforeunload after a write fails', async () => {
		const { promise, reject } = deferred<void>();

		const tracked = trackPendingWrite(promise);
		reject(new Error('save failed'));
		await expect(tracked).rejects.toThrow('save failed');

		expect(hasPendingWrites()).toBe(false);
		expect(fireBeforeUnload()).toBe(false);
	});
});
