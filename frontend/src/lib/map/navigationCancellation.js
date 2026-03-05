// frontend/src/lib/map/navigationCancellation.js
import { afterNavigate, beforeNavigate } from '$app/navigation';

import { tileLoadingManager } from './tileLoadingManager.js';
import { getWorkerPool } from './workerPool.js';

/**
 * Set up navigation cancellation for tile loading.
 * Call this in the root layout to cancel all pending tile requests on navigation.
 */
export function setupNavigationCancellation() {
	beforeNavigate(({ from, to }) => {
		// Only pause if navigating to a different page (not same page with different params)
		const fromPath = from?.route?.id;
		const toPath = to?.route?.id;
		const isDifferentPage = fromPath !== toPath;

		// Cancel all pending fetch requests (pause only if leaving the page)
		tileLoadingManager.cancelAllRequests(isDifferentPage);

		// Cancel all pending worker parse requests
		const workerPool = getWorkerPool();
		workerPool.cancelAllRequests();
	});

	afterNavigate(() => {
		// Always resume loading after navigation completes
		tileLoadingManager.resume();
	});
}
