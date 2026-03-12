// frontend/src/lib/map/workerPool.test.js
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { WorkerPool } from './workerPool.js';

// Mock Worker since it's not available in Node
class MockWorker {
	/** @type {((event: {data: unknown}) => void) | null} */
	onmessage = null;
	postMessage = vi.fn();
	terminate = vi.fn();

	/** @param {unknown} data */
	simulateResponse(data) {
		if (this.onmessage) {
			this.onmessage({ data });
		}
	}
}

vi.stubGlobal('Worker', MockWorker);

describe('WorkerPool', () => {
	/** @type {WorkerPool} */
	let pool;

	beforeEach(() => {
		pool = new WorkerPool(2);
	});

	afterEach(() => {
		pool.destroy();
	});

	test('should create specified number of workers', () => {
		expect(pool.workers.length).toBe(2);
	});

	test('should process parse request and return result', async () => {
		const mockData = new ArrayBuffer(10);
		const extent = [0, 0, 100, 100];
		const projection = 'EPSG:3857';

		const parsePromise = pool.parse('req-1', mockData, extent, projection);

		// Simulate worker response
		const worker = /** @type {MockWorker} */ (/** @type {unknown} */ (pool.workers[0]));
		worker.simulateResponse({
			requestId: 'req-1',
			success: true,
			features: [{ id: '1', properties: { name: 'test' } }]
		});

		const result = await parsePromise;
		expect(result.success).toBe(true);
		expect(result.features).toHaveLength(1);
	});

	test('should handle parse errors', async () => {
		const mockData = new ArrayBuffer(10);

		const parsePromise = pool.parse('req-1', mockData, [0, 0, 100, 100], 'EPSG:3857');

		const worker = /** @type {MockWorker} */ (/** @type {unknown} */ (pool.workers[0]));
		worker.simulateResponse({
			requestId: 'req-1',
			success: false,
			error: 'Parse failed'
		});

		const result = await parsePromise;
		expect(result.success).toBe(false);
		expect(result.error).toBe('Parse failed');
	});

	test('should distribute work across workers via round-robin', () => {
		pool.parse('req-1', new ArrayBuffer(10), [0, 0, 100, 100], 'EPSG:3857');
		pool.parse('req-2', new ArrayBuffer(10), [0, 0, 100, 100], 'EPSG:3857');
		pool.parse('req-3', new ArrayBuffer(10), [0, 0, 100, 100], 'EPSG:3857');

		expect(pool.workers[0].postMessage).toHaveBeenCalledTimes(2);
		expect(pool.workers[1].postMessage).toHaveBeenCalledTimes(1);
	});

	test('should terminate all workers on destroy', () => {
		pool.destroy();

		for (const worker of pool.workers) {
			expect(worker.terminate).toHaveBeenCalled();
		}
	});
});
