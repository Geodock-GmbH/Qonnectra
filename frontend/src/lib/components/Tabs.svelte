<script>
	import { innerWidth } from 'svelte/reactivity/window';
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
	 *   orientation?: 'vertical' | 'horizontal'
	 * }}
	 */
	let {
		tabs,
		value = $bindable(tabs[0]?.value || ''),
		onValueChange = () => {},
		children: contentSnippet,
		class: className = '',
		orientation = 'vertical'
	} = $props();

	let isMobile = $derived((innerWidth.current ?? 0) < 768);
	let effectiveOrientation = $derived(isMobile ? 'horizontal' : orientation);

	function handleValueChange(/** @type {{ value: string }} */ e) {
		value = e.value;
		onValueChange(e.value);
	}
</script>

<SkeletonTabs {value} onValueChange={handleValueChange} orientation={effectiveOrientation}>
	<div
		class="tabs-wrapper {effectiveOrientation === 'horizontal'
			? 'tabs-horizontal'
			: ''} {className}"
	>
		<!-- Tab List -->
		<SkeletonTabs.List>
			{#each tabs as tab (tab.value)}
				<SkeletonTabs.Trigger class="justify-start" value={tab.value}>
					{tab.label}
				</SkeletonTabs.Trigger>
			{/each}
			<SkeletonTabs.Indicator />
		</SkeletonTabs.List>
		<!-- Tab Content -->
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

	:global([data-scope='tabs'][data-orientation='horizontal']) {
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

	.tabs-wrapper.tabs-horizontal {
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
		gap: 0;
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

	.tabs-wrapper:not(.tabs-horizontal) :global([data-part='indicator']) {
		right: 0 !important;
		left: auto !important;
		width: 3px !important;
	}

	/* Horizontal mobile: scrollable tab list */
	.tabs-wrapper.tabs-horizontal :global([data-part='list']) {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		padding-right: 0;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid var(--color-surface-200-800);
	}

	.tabs-wrapper.tabs-horizontal :global([data-part='list'])::-webkit-scrollbar {
		display: none;
	}

	.tabs-wrapper.tabs-horizontal :global([data-part='list'])::after {
		display: none;
	}

	.tabs-wrapper.tabs-horizontal :global([data-part='trigger']) {
		white-space: nowrap;
		flex-shrink: 0;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
	}

	.tab-content {
		min-width: 0;
		overflow-y: auto;
	}

	.tabs-horizontal .tab-content {
		padding-top: 0.75rem;
	}
</style>
