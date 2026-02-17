<script>
	import { onMount } from 'svelte';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	/**
	 * @typedef {Object} TabItem
	 * @property {string} value - Unique identifier for the tab
	 * @property {string} label - Display label for the tab
	 */

	/**
	 * @type {{
	 *   tabs: TabItem[],
	 *   value?: string,
	 *   onValueChange?: (value: string) => void,
	 *   children?: import('svelte').Snippet,
	 *   class?: string,
	 *   verticalBreakpoint?: number
	 * }}
	 */
	let {
		tabs,
		value = $bindable(tabs[0]?.value || ''),
		onValueChange = () => {},
		children,
		class: className = '',
		verticalBreakpoint = 300
	} = $props();

	let containerRef = $state(null);
	let isVertical = $state(false);

	function handleValueChange(e) {
		value = e.value;
		onValueChange(e.value);
	}

	onMount(() => {
		if (!containerRef) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				isVertical = entry.contentRect.width < verticalBreakpoint;
			}
		});

		resizeObserver.observe(containerRef);

		return () => resizeObserver.disconnect();
	});
</script>

<div class="tabs-wrapper {className}" bind:this={containerRef}>
	<SkeletonTabs
		{value}
		onValueChange={handleValueChange}
		orientation={isVertical ? 'vertical' : 'horizontal'}
	>
		<SkeletonTabs.List>
			{#each tabs as tab (tab.value)}
				<SkeletonTabs.Trigger
					class={isVertical ? 'justify-start' : 'flex-1 min-w-0 truncate'}
					value={tab.value}
				>
					{tab.label}
				</SkeletonTabs.Trigger>
			{/each}
			<SkeletonTabs.Indicator />
		</SkeletonTabs.List>
		{@render children?.()}
	</SkeletonTabs>
</div>
