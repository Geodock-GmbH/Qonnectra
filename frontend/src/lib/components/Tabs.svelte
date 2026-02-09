<script>
	// Skeleton
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
	 *   class?: string
	 * }}
	 */
	let {
		tabs,
		value = $bindable(tabs[0]?.value || ''),
		onValueChange = () => {},
		children,
		class: className = ''
	} = $props();

	function handleValueChange(e) {
		value = e.value;
		onValueChange(e.value);
	}
</script>

<div class="tabs-wrapper {className}">
	<SkeletonTabs {value} onValueChange={handleValueChange}>
		<SkeletonTabs.List>
			{#each tabs as tab (tab.value)}
				<SkeletonTabs.Trigger class="flex-1 min-w-0 truncate" value={tab.value}>
					{tab.label}
				</SkeletonTabs.Trigger>
			{/each}
			<SkeletonTabs.Indicator />
		</SkeletonTabs.List>
		{@render children?.()}
	</SkeletonTabs>
</div>
