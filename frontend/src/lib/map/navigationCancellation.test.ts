import { afterEach, describe, expect, test, vi } from 'vitest';

import { setupNavigationCancellation } from './navigationCancellation';
import { tileLoadingManager } from './tileLoadingManager';

const navigationCallbacks: {
	before?: (navigation: {
		from: { route: { id: string | null } } | null;
		to: { route: { id: string | null } } | null;
	}) => void;
	after?: () => void;
} = {};

vi.mock('$app/navigation', () => ({
	beforeNavigate: vi.fn((callback) => {
		navigationCallbacks.before = callback;
	}),
	afterNavigate: vi.fn((callback) => {
		navigationCallbacks.after = callback;
	})
}));

vi.mock('./tileLoadingManager', () => ({
	tileLoadingManager: {
		cancelAllRequests: vi.fn(),
		resume: vi.fn()
	}
}));

const workerPoolCancelAllRequests = vi.fn();

vi.mock('./workerPool', () => ({
	getWorkerPool: vi.fn(() => ({ cancelAllRequests: workerPoolCancelAllRequests }))
}));

function navigate(fromRouteId: string | null, toRouteId: string | null) {
	navigationCallbacks.before?.({
		from: fromRouteId === null ? null : { route: { id: fromRouteId } },
		to: toRouteId === null ? null : { route: { id: toRouteId } }
	});
}

afterEach(() => {
	vi.clearAllMocks();
});

describe('setupNavigationCancellation', () => {
	test('should cancel tile and worker requests when leaving the page', () => {
		setupNavigationCancellation();

		navigate('/map/[[projectId]]', '/dashboard/[[projectId]]/[[flagId]]');

		expect(tileLoadingManager.cancelAllRequests).toHaveBeenCalledWith(true);
		expect(workerPoolCancelAllRequests).toHaveBeenCalledTimes(1);
	});

	test('should not cancel requests for same-page navigation', () => {
		setupNavigationCancellation();

		navigate('/map/[[projectId]]', '/map/[[projectId]]');

		expect(tileLoadingManager.cancelAllRequests).not.toHaveBeenCalled();
		expect(workerPoolCancelAllRequests).not.toHaveBeenCalled();
	});

	test('should resume tile loading after navigation completes', () => {
		setupNavigationCancellation();

		navigationCallbacks.after?.();

		expect(tileLoadingManager.resume).toHaveBeenCalledTimes(1);
	});
});
