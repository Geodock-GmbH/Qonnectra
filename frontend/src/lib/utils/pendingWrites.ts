let pendingCount = 0;

/**
 * Warns the browser that unsaved work is in flight so reloads and tab closes
 * prompt the user instead of silently aborting pending persistence requests.
 * @param event - The beforeunload event to cancel
 */
function handleBeforeUnload(event: BeforeUnloadEvent): void {
	event.preventDefault();
	// Chrome requires returnValue to be set for the prompt to appear.
	event.returnValue = true;
}

/**
 * Whether any tracked persistence request is still in flight.
 * @returns True while at least one tracked write has not settled
 */
export function hasPendingWrites(): boolean {
	return pendingCount > 0;
}

/**
 * Tracks a persistence request so the browser blocks unload while it is in
 * flight. Resolves or rejects with the wrapped promise's outcome.
 * @param promise - The in-flight persistence request
 * @returns The wrapped promise's value once it settles
 */
export async function trackPendingWrite<T>(promise: Promise<T>): Promise<T> {
	if (pendingCount === 0) {
		window.addEventListener('beforeunload', handleBeforeUnload);
	}
	pendingCount++;

	try {
		return await promise;
	} finally {
		pendingCount--;
		if (pendingCount === 0) {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		}
	}
}
