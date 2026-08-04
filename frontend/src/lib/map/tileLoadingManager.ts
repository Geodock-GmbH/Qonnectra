/**
 * Manages tile loading requests with AbortController support.
 * Allows cancellation of all pending requests on navigation.
 */
export class TileLoadingManager {
	abortControllers: Map<string, AbortController>;
	isPaused: boolean;

	constructor() {
		this.abortControllers = new Map();
		this.isPaused = false;
	}

	/** Check if tile loading is paused (during navigation) */
	isLoadingPaused(): boolean {
		return this.isPaused;
	}

	/** Pause tile loading (call on navigation start) */
	pause(): void {
		this.isPaused = true;
	}

	/** Resume tile loading (call when map remounts) */
	resume(): void {
		this.isPaused = false;
	}

	/** Create and register an AbortController for a tile request */
	createAbortController(requestId: string): AbortController {
		const controller = new AbortController();
		this.abortControllers.set(requestId, controller);
		return controller;
	}

	/** Remove an AbortController after request completes */
	removeAbortController(requestId: string): void {
		this.abortControllers.delete(requestId);
	}

	/** Cancel all pending requests */
	cancelAllRequests(andPause = false): void {
		if (andPause) {
			this.isPaused = true;
		}
		for (const controller of this.abortControllers.values()) {
			controller.abort();
		}
		this.abortControllers.clear();
	}

	/** Get count of active requests */
	getActiveRequestCount(): number {
		return this.abortControllers.size;
	}

	/** Clean up resources */
	destroy(): void {
		this.cancelAllRequests();
	}
}

/** Singleton instance for global access */
export const tileLoadingManager = new TileLoadingManager();
