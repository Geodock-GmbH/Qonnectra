import { describe, expect, test } from 'vitest';

import { withCableLock } from './_cable-lock';

/**
 * Defers resolution so a test can control exactly when a locked operation finishes.
 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
}

describe('withCableLock', () => {
	test('serializes operations for the same cable so the second sees the first result', async () => {
		// Simulates the label upsert: a shared "row" the first op creates and the
		// second op must observe (rather than creating a duplicate).
		let row: string | null = null;
		const order: string[] = [];

		const first = withCableLock('cable-1', async () => {
			order.push('first-start');
			await Promise.resolve();
			if (row === null) row = 'created-by-first';
			order.push('first-end');
			return row;
		});

		const second = withCableLock('cable-1', async () => {
			order.push('second-start');
			// If this ran concurrently with `first`, row would still be null here
			// and it would create a duplicate. Serialization guarantees it isn't.
			expect(row).toBe('created-by-first');
			order.push('second-end');
			return row;
		});

		await Promise.all([first, second]);

		// The second op started only after the first fully finished.
		expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
	});

	test('runs operations for different cables concurrently', async () => {
		const a = deferred<string>();
		const b = deferred<string>();
		const started: string[] = [];

		const opA = withCableLock('cable-a', async () => {
			started.push('a');
			return a.promise;
		});
		const opB = withCableLock('cable-b', async () => {
			started.push('b');
			return b.promise;
		});

		// Both started without either resolving — they are not serialized together.
		// A macrotask flush lets both queued callbacks run before we assert.
		await new Promise((r) => setTimeout(r, 0));
		expect(started).toEqual(['a', 'b']);

		a.resolve('done-a');
		b.resolve('done-b');
		expect(await Promise.all([opA, opB])).toEqual(['done-a', 'done-b']);
	});

	test('a rejected operation does not block the next one for the same cable', async () => {
		const first = withCableLock('cable-1', async () => {
			throw new Error('boom');
		});
		await expect(first).rejects.toThrow('boom');

		const second = withCableLock('cable-1', async () => 'ok');
		await expect(second).resolves.toBe('ok');
	});
});
