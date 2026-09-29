<script lang="ts">
	import type { Snippet } from 'svelte';
	import { innerWidth } from 'svelte/reactivity/window';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	interface TabItem {
		/** Unique identifier for the tab */
		value: string;
		/** Display label for the tab */
		label: string;
	}

	interface Props {
		tabs: TabItem[];
		/** The selected tab; a value not in `tabs` shows the first tab instead. */
		value?: string;
		/** Called only when the user picks a tab, never on a list change. */
		onValueChange?: (value: string) => void;
		children?: Snippet;
		class?: string;
		orientation?: 'vertical' | 'horizontal';
	}

	let {
		tabs,
		value = $bindable(tabs[0]?.value || ''),
		onValueChange = () => {},
		children: contentSnippet,
		class: className = '',
		orientation = 'vertical'
	}: Props = $props();

	let isMobile = $derived((innerWidth.current ?? 0) < 768);
	let effectiveOrientation = $derived(isMobile ? 'horizontal' : orientation);

	// A value the current list does not offer (a stale URL, a list that
	// resolved late) shows the first tab without rewriting anything.
	const effectiveValue = $derived(
		tabs.some((tab) => tab.value === value) ? value : (tabs[0]?.value ?? '')
	);

	function handleValueChange(e: { value: string }) {
		value = e.value;
		onValueChange(e.value);
	}
</script>

<div class="custom-tabs-root">
	<SkeletonTabs
		value={effectiveValue}
		onValueChange={handleValueChange}
		orientation={effectiveOrientation}
	>
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
</div>

<style>
	.custom-tabs-root {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.custom-tabs-root :global([data-scope='tabs'][data-orientation='vertical']) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.custom-tabs-root :global([data-scope='tabs'][data-orientation='horizontal']) {
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

	.tabs-wrapper :global([data-scope='tabs'][data-part='list']) {
		align-self: start;
		position: relative;
		padding-right: 0.5rem;
	}

	.tabs-wrapper :global([data-scope='tabs'][data-part='list'])::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 1px;
		height: 100vh;
		background-color: var(--color-surface-200-800);
	}

	.tabs-wrapper:not(.tabs-horizontal) :global([data-scope='tabs'][data-part='indicator']) {
		right: 0 !important;
		left: auto !important;
		width: 3px !important;
	}

	/* Horizontal mobile: scrollable tab list */
	.tabs-wrapper.tabs-horizontal :global([data-scope='tabs'][data-part='list']) {
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

	.tabs-wrapper.tabs-horizontal :global([data-scope='tabs'][data-part='list'])::-webkit-scrollbar {
		display: none;
	}

	.tabs-wrapper.tabs-horizontal :global([data-scope='tabs'][data-part='list'])::after {
		display: none;
	}

	.tabs-wrapper.tabs-horizontal :global([data-scope='tabs'][data-part='trigger']) {
		white-space: nowrap;
		flex-shrink: 0;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
	}

	.tab-content {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
	}

	.tabs-horizontal .tab-content {
		padding-top: 0.75rem;
	}
</style>
