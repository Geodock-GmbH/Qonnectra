<script>
	import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children] - The element(s) that trigger the tooltip
	 * @property {string} content - The tooltip text content
	 * @property {'top' | 'bottom' | 'left' | 'right'} [position='top'] - Position of the tooltip
	 * @property {number} [delay=200] - Delay in milliseconds before showing tooltip
	 */

	/** @type {Props} */
	let { children, content, position = 'top', delay = 200 } = $props();
</script>

<Tooltip openDelay={delay} closeDelay={150}>
	<Tooltip.Trigger>
		{@render children?.()}
	</Tooltip.Trigger>
	<Portal>
		<Tooltip.Positioner placement={position}>
			<Tooltip.Content
				class="bg-surface-100-900 text-surface-900-100 px-3 py-2 rounded text-sm whitespace-nowrap shadow-lg z-[1000]"
			>
				{content}
			</Tooltip.Content>
		</Tooltip.Positioner>
	</Portal>
</Tooltip>
