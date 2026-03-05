// frontend/src/lib/map/tileLoadingManager.js

/**
 * Manages tile loading requests with AbortController support.
 * Allows cancellation of all pending requests on navigation.
 */
export class TileLoadingManager {
	constructor() {
		/** @type {Map<string, AbortController>} */
		this.abortControllers = new Map();
		/** @type {boolean} */
		this.isPaused = false;
	}

	/**
	 * Check if tile loading is paused (during navigation)
	 * @returns {boolean}
	 */
	isLoadingPaused() {
		return this.isPaused;
	}

	/**
	 * Pause tile loading (call on navigation start)
	 */
	pause() {
		this.isPaused = true;
	}

	/**
	 * Resume tile loading (call when map remounts)
	 */
	resume() {
		this.isPaused = false;
	}

	/**
	 * Create and register an AbortController for a tile request
	 * @param {string} requestId - Unique identifier for the request
	 * @returns {AbortController}
	 */
	createAbortController(requestId) {
		const controller = new AbortController();
		this.abortControllers.set(requestId, controller);
		return controller;
	}

	/**
	 * Remove an AbortController after request completes
	 * @param {string} requestId - Unique identifier for the request
	 */
	removeAbortController(requestId) {
		this.abortControllers.delete(requestId);
	}

	/**
	 * Cancel all pending requests
	 * @param {boolean} [andPause=false] - Also pause new requests
	 */
	cancelAllRequests(andPause = false) {
		if (andPause) {
			this.isPaused = true;
		}
		for (const controller of this.abortControllers.values()) {
			controller.abort();
		}
		this.abortControllers.clear();
	}

	/**
	 * Get count of active requests
	 * @returns {number}
	 */
	getActiveRequestCount() {
		return this.abortControllers.size;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.cancelAllRequests();
	}
}

/** Singleton instance for global access */
export const tileLoadingManager = new TileLoadingManager();
