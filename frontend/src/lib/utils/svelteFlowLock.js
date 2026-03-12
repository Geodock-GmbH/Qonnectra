/**
 * Auto-clicks the SvelteFlow interactivity lock button to start with a locked canvas.
 * Polls the DOM until the button appears or the maximum number of attempts is reached.
 * @param {number} [maxAttempts=10] - Maximum number of polling attempts.
 * @param {number} [intervalMs=100] - Interval between attempts in milliseconds.
 * @returns {Promise<boolean>} Whether the button was found and clicked.
 */
export async function autoLockSvelteFlow(maxAttempts = 10, intervalMs = 100) {
	return new Promise((resolve) => {
		let attempts = 0;

		const tryClickLockButton = () => {
			attempts++;

			const lockButton = /** @type {HTMLButtonElement | null} */ (
				document.querySelector(
					'button.svelte-flow__controls-button.svelte-flow__controls-interactive[title="Toggle Interactivity"]'
				)
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
 * @returns {boolean} Whether the canvas is locked, or false if the button is not found.
 */
export function isSvelteFlowLocked() {
	const lockButton = /** @type {HTMLButtonElement | null} */ (
		document.querySelector(
			'button.svelte-flow__controls-button.svelte-flow__controls-interactive[title="Toggle Interactivity"]'
		)
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
 * @returns {boolean} Whether the button was found and clicked.
 */
export function toggleSvelteFlowLock() {
	const lockButton = /** @type {HTMLButtonElement | null} */ (
		document.querySelector(
			'button.svelte-flow__controls-button.svelte-flow__controls-interactive[title="Toggle Interactivity"]'
		)
	);

	if (lockButton) {
		lockButton.click();
		return true;
	}

	console.warn('SvelteFlow lock button not found');
	return false;
}
