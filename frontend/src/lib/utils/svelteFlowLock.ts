/**
 * Auto-clicks the SvelteFlow interactivity lock button to start with a locked canvas.
 * Polls the DOM until the button appears or the maximum number of attempts is reached.
 * @param maxAttempts - Maximum number of polling attempts.
 * @param intervalMs - Interval between attempts in milliseconds.
 */
export async function autoLockSvelteFlow(maxAttempts = 10, intervalMs = 100): Promise<boolean> {
	return new Promise((resolve) => {
		let attempts = 0;

		const tryClickLockButton = () => {
			attempts++;

			const lockButton = document.querySelector<HTMLButtonElement>(
				'button.svelte-flow__controls-button.svelte-flow__controls-interactive[title="Toggle Interactivity"]'
			);

			if (lockButton) {
				lockButton.click();
				resolve(true);
				return;
			}

			if (attempts < maxAttempts) {
				setTimeout(tryClickLockButton, intervalMs);
			} else {
				console.warn('SvelteFlow lock button not found after', maxAttempts, 'attempts');
				resolve(false);
			}
		};

		tryClickLockButton();
	});
}

/**
 * Checks whether the SvelteFlow canvas is currently in a locked (non-interactive) state.
 */
export function isSvelteFlowLocked(): boolean {
	const lockButton = document.querySelector<HTMLButtonElement>(
		'button.svelte-flow__controls-button.svelte-flow__controls-interactive[title="Toggle Interactivity"]'
	);

	if (!lockButton) {
		return false;
	}

	return (
		lockButton.classList.contains('active') || lockButton.getAttribute('aria-pressed') === 'true'
	);
}

/**
 * Toggles the SvelteFlow canvas interactivity lock state.
 */
export function toggleSvelteFlowLock(): boolean {
	const lockButton = document.querySelector<HTMLButtonElement>(
		'button.svelte-flow__controls-button.svelte-flow__controls-interactive[title="Toggle Interactivity"]'
	);

	if (lockButton) {
		lockButton.click();
		return true;
	}

	console.warn('SvelteFlow lock button not found');
	return false;
}
