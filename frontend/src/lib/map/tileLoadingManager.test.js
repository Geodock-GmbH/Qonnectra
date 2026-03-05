// frontend/src/lib/map/tileLoadingManager.test.js
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { TileLoadingManager } from './tileLoadingManager.js';

describe('TileLoadingManager', () => {
	let manager;

	beforeEach(() => {
		manager = new TileLoadingManager();
	});

	afterEach(() => {
		manager.destroy();
	});

	test('should register and track abort controllers', () => {
		const controller = manager.createAbortController('tile-1');
		expect(controller).toBeInstanceOf(AbortController);
		expect(manager.getActiveRequestCount()).toBe(1);
	});

	test('should remove controller when request completes', () => {
		const controller = manager.createAbortController('tile-1');
		manager.removeAbortController('tile-1');
		expect(manager.getActiveRequestCount()).toBe(0);
	});

	test('should cancel all pending requests', () => {
		const controller1 = manager.createAbortController('tile-1');
		const controller2 = manager.createAbortController('tile-2');

		const abortSpy1 = vi.spyOn(controller1, 'abort');
		const abortSpy2 = vi.spyOn(controller2, 'abort');

		manager.cancelAllRequests();

		expect(abortSpy1).toHaveBeenCalled();
		expect(abortSpy2).toHaveBeenCalled();
		expect(manager.getActiveRequestCount()).toBe(0);
	});
});
