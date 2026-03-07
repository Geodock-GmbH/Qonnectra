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
		const fromPath = from?.route?.id;
		const toPath = to?.route?.id;
		const isDifferentPage = fromPath !== toPath;

		// Only cancel requests when actually leaving the page.
		// Same-page navigations (e.g. project switch on /map) should NOT cancel
		// tile requests — reinitializeForProject() replaces the sources and
		// old requests are harmless.
		if (isDifferentPage) {
			tileLoadingManager.cancelAllRequests(true);

			const workerPool = getWorkerPool();
			workerPool.cancelAllRequests();
		}
	});

	afterNavigate(() => {
		// Always resume loading after navigation completes
		tileLoadingManager.resume();
	});
}
