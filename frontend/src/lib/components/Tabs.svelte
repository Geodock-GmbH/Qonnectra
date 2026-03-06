<script>
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
		children: contentSnippet,
		class: className = ''
	} = $props();

	function handleValueChange(e) {
		value = e.value;
		onValueChange(e.value);
	}
</script>

<SkeletonTabs {value} onValueChange={handleValueChange} orientation="vertical">
	<div class="tabs-wrapper {className}">
		<SkeletonTabs.List>
			{#each tabs as tab (tab.value)}
				<SkeletonTabs.Trigger class="justify-start" value={tab.value}>
					{tab.label}
				</SkeletonTabs.Trigger>
			{/each}
			<SkeletonTabs.Indicator />
		</SkeletonTabs.List>
		<div class="tab-content">
			{@render contentSnippet?.()}
		</div>
	</div>
</SkeletonTabs>

<style>
	:global([data-scope='tabs'][data-orientation='vertical']) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.tabs-wrapper {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
	}

	.tabs-wrapper :global([data-part='list']) {
		align-self: start;
		position: relative;
		padding-right: 0.5rem;
	}

	.tabs-wrapper :global([data-part='list'])::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 1px;
		height: 100vh;
		background-color: var(--color-surface-200-800);
	}

	.tabs-wrapper :global([data-part='indicator']) {
		right: 0 !important;
		left: auto !important;
		width: 3px !important;
	}

	.tab-content {
		min-width: 0;
		overflow-y: auto;
	}
</style>
