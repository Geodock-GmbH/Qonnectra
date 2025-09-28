/**
 * Utility function to automatically click the SvelteFlow lock button to start with locked interactivity
 * This function should be called after the SvelteFlow component is fully mounted
 */

/**
 * Auto-clicks the SvelteFlow interactivity lock button to start with locked canvas
 * @param {number} maxAttempts - Maximum number of attempts to find and click the button (default: 10)
 * @param {number} intervalMs - Interval between attempts in milliseconds (default: 100)
 * @returns {Promise<boolean>} - Returns true if button was found and clicked, false otherwise
 */
export async function autoLockSvelteFlow(maxAttempts = 10, intervalMs = 100) {
	return new Promise((resolve) => {
		let attempts = 0;

		const tryClickLockButton = () => {
			attempts++;

			const lockButton = document.querySelector(
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
 * Checks if the SvelteFlow canvas is currently locked
 * @returns {boolean} - Returns true if canvas is locked, false if unlocked or button not found
 */
export function isSvelteFlowLocked() {
	const lockButton = document.querySelector(
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
 * Manually toggles the SvelteFlow lock state
 * @returns {boolean} - Returns true if button was found and clicked, false otherwise
 */
export function toggleSvelteFlowLock() {
	const lockButton = document.querySelector(
		'button.svelte-flow__controls-button.svelte-flow__controls-interactive[title="Toggle Interactivity"]'
	);

	if (lockButton) {
		lockButton.click();
		return true;
	}

	console.warn('SvelteFlow lock button not found');
	return false;
}
