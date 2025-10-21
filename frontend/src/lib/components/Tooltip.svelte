<script>
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children] - The element(s) that trigger the tooltip
	 * @property {string} content - The tooltip text content
	 * @property {'top' | 'bottom' | 'left' | 'right'} [position='top'] - Position of the tooltip
	 * @property {number} [delay=200] - Delay in milliseconds before showing tooltip
	 */

	/** @type {Props} */
	let { children, content, position = 'top', delay = 200 } = $props();

	let showTooltip = $state(false);
	let timeoutId = $state(null);

	/**
	 * Shows the tooltip after delay
	 */
	function handleMouseEnter() {
		timeoutId = setTimeout(() => {
			showTooltip = true;
		}, delay);
	}

	/**
	 * Hides the tooltip immediately
	 */
	function handleMouseLeave() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		showTooltip = false;
	}

	/**
	 * Cleanup timeout on unmount
	 */
	$effect(() => {
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});
</script>

<span
	class="tooltip-wrapper"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	role="tooltip"
	aria-describedby={showTooltip ? 'tooltip' : undefined}
>
	{@render children?.()}

	{#if showTooltip}
		<span id="tooltip" class="tooltip tooltip-{position}" role="tooltip">
			{content}
		</span>
	{/if}
</span>

<style>
	.tooltip-wrapper {
		position: relative;
		display: inline-block;
	}

	.tooltip {
		position: absolute;
		background-color: rgba(0, 0, 0, 0.9);
		color: white;
		padding: 0.5rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		white-space: nowrap;
		z-index: 1000;
		pointer-events: none;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	/* Position variations */
	.tooltip-top {
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
	}

	.tooltip-top::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: rgba(0, 0, 0, 0.9);
	}

	.tooltip-bottom {
		top: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
	}

	.tooltip-bottom::after {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-bottom-color: rgba(0, 0, 0, 0.9);
	}

	.tooltip-left {
		right: calc(100% + 8px);
		top: 50%;
		transform: translateY(-50%);
	}

	.tooltip-left::after {
		content: '';
		position: absolute;
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		border: 4px solid transparent;
		border-left-color: rgba(0, 0, 0, 0.9);
	}

	.tooltip-right {
		left: calc(100% + 8px);
		top: 50%;
		transform: translateY(-50%);
	}

	.tooltip-right::after {
		content: '';
		position: absolute;
		right: 100%;
		top: 50%;
		transform: translateY(-50%);
		border: 4px solid transparent;
		border-right-color: rgba(0, 0, 0, 0.9);
	}
</style>
