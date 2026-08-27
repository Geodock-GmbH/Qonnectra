<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';

	interface Props {
		/** The element(s) that trigger the tooltip */
		children?: Snippet;
		/** The tooltip text content */
		content: string;
		/** Position of the tooltip */
		position?: 'top' | 'bottom' | 'left' | 'right';
		/** Delay in milliseconds before showing tooltip */
		delay?: number;
	}

	let { children, content, position = 'top', delay = 200 }: Props = $props();
</script>

<Tooltip openDelay={delay} closeDelay={150} positioning={{ placement: position }}>
	<Tooltip.Trigger>
		{@render children?.()}
	</Tooltip.Trigger>
	<Portal>
		<Tooltip.Positioner>
			<Tooltip.Content
				class="bg-surface-100-900 text-surface-900-100 px-3 py-2 rounded text-sm whitespace-nowrap shadow-lg z-1000"
			>
				{content}
			</Tooltip.Content>
		</Tooltip.Positioner>
	</Portal>
</Tooltip>
