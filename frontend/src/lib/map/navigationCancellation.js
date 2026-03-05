// frontend/src/lib/map/navigationCancellation.js
import { beforeNavigate } from '$app/navigation';

import { tileLoadingManager } from './tileLoadingManager.js';
import { getWorkerPool } from './workerPool.js';

/**
 * Set up navigation cancellation for tile loading.
 * Call this in the root layout to cancel all pending tile requests on navigation.
 */
export function setupNavigationCancellation() {
	beforeNavigate(() => {
		// Cancel all pending fetch requests
		tileLoadingManager.cancelAllRequests();

		// Cancel all pending worker parse requests
		const workerPool = getWorkerPool();
		workerPool.cancelAllRequests();
	});
}
