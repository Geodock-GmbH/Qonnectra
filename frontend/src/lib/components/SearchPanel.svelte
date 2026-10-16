<script lang="ts">
	import type { SearchFeaturePayload } from '$lib/map/searchUtils';
	import type { SearchResult } from '$lib/remote/map/feature-search-data';
	import type VectorLayer from 'ol/layer/Vector';
	import type OlMap from 'ol/Map';
	import type VectorSource from 'ol/source/Vector';
	import { tick } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/state';
	import Fuse from 'fuse.js';

	import { m } from '$lib/paraglide/messages';

	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import {
		createHighlightLayer,
		debounce,
		parseFeatureGeometry,
		parseMultipleFeatureGeometries,
		zoomToFeature,
		zoomToMultipleFeatures
	} from '$lib/map/searchUtils';
	import { createSearchHighlightStyle } from '$lib/map/styles';
	import { globalMapView } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import {
		getConduitTrenches,
		getFeatureDetails,
		searchFeatures
	} from '$lib/remote/map/feature-search.remote';

	import SearchInput from './SearchInput.svelte';

	interface Props {
		olMapInstance?: OlMap | null;
		/** The project searched; empty in the global view or on a page without one. */
		projectId?: string;
		trenchColorSelected?: string;
		onFeatureSelect?: (feature: SearchFeaturePayload) => void;
		onSearchError?: (error: unknown) => void;
	}

	let {
		olMapInstance = null,
		projectId = '',
		trenchColorSelected = '#ff0000',
		onFeatureSelect = () => {},
		onSearchError = () => {}
	}: Props = $props();

	let searchQuery = $state('');
	let searchResults = $state<SearchResult[]>([]);
	let filterQuery = $state('');
	let isSearching = $state(false);
	let showSearchResults = $state(false);
	let highlightLayer = $state<VectorLayer<VectorSource> | undefined>();
	/** Result highlighted by the arrow keys or the pointer; -1 when none. */
	let activeIndex = $state(-1);

	const FILTER_THRESHOLD = 10;
	const listboxId = $props.id();

	/** Fuzzy matcher over the current hits; the name counts double over context and project. */
	const fuse = $derived(
		new Fuse(searchResults, {
			keys: [{ name: 'label', weight: 2 }, 'detail', 'project'],
			threshold: 0.3
		})
	);

	/** Hits narrowed by the filter input; all hits when the filter is empty or matches nothing. */
	let filteredResults = $derived.by(() => {
		if (!filterQuery.trim()) return searchResults;
		const results = fuse.search(filterQuery);
		return results.length > 0 ? results.map((r) => r.item) : searchResults;
	});

	/** Whether the result list is shown; drives the combobox's `aria-expanded`. */
	const isListOpen = $derived(showSearchResults && searchResults.length > 0 && !isSearching);

	/** Combobox wiring shared by the search and the filter input. */
	const comboboxAttributes = $derived({
		'aria-controls': listboxId,
		'aria-activedescendant': activeIndex >= 0 ? optionId(activeIndex) : undefined
	});

	const TYPE_CONFIG: Record<
		string,
		{ getLabel: () => string; bg: string; text: string; darkBg: string; darkText: string }
	> = {
		address: {
			getLabel: () => m.form_address({ count: 1 }),
			bg: 'bg-emerald-500/15',
			text: 'text-emerald-600',
			darkBg: 'dark:bg-emerald-400/20',
			darkText: 'dark:text-emerald-400'
		},
		node: {
			getLabel: () => m.form_node(),
			bg: 'bg-blue-500/15',
			text: 'text-blue-600',
			darkBg: 'dark:bg-blue-400/20',
			darkText: 'dark:text-blue-400'
		},
		trench: {
			getLabel: () => m.nav_trench(),
			bg: 'bg-purple-500/15',
			text: 'text-purple-600',
			darkBg: 'dark:bg-purple-400/20',
			darkText: 'dark:text-purple-400'
		},
		conduit: {
			getLabel: () => m.form_conduit({ count: 1 }),
			bg: 'bg-amber-500/15',
			text: 'text-amber-600',
			darkBg: 'dark:bg-amber-400/20',
			darkText: 'dark:text-amber-400'
		},
		area: {
			getLabel: () => m.form_area(),
			bg: 'bg-rose-500/15',
			text: 'text-rose-600',
			darkBg: 'dark:bg-rose-400/20',
			darkText: 'dark:text-rose-400'
		}
	};

	/**
	 * Builds the DOM id of a result option, unique per panel instance.
	 * @param index - Position in the filtered results.
	 * @returns The option id.
	 */
	function optionId(index: number): string {
		return `${listboxId}-option-${index}`;
	}

	/**
	 * Context line below a result name; the project is only added in the
	 * global view, where hits from several projects mix.
	 * @param result - The search hit.
	 * @returns Detail and project joined with ` · `.
	 */
	function resultContext(result: SearchResult): string {
		return [result.detail, $globalMapView ? result.project : ''].filter(Boolean).join(' · ');
	}

	/**
	 * Arrow keys move the highlight through the results, Enter selects the
	 * highlighted one and Escape closes the list. Without a highlight, Enter
	 * falls through to the input's own handling.
	 * @param event - Keydown on the search or filter input.
	 */
	async function handleListKeydown(event: KeyboardEvent) {
		if (!isListOpen) return;
		const lastIndex = filteredResults.length - 1;

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			activeIndex = Math.min(Math.max(activeIndex + step, 0), lastIndex);
			await tick();
			document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
		} else if (event.key === 'Enter' && activeIndex >= 0) {
			event.preventDefault();
			void handleResultClick(filteredResults[activeIndex]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			showSearchResults = false;
			activeIndex = -1;
		}
	}

	/** Searches all feature kinds for the query; an empty query just closes the list. */
	const debouncedSearch = debounce(async (query: string) => {
		if (!query.trim()) {
			searchResults = [];
			showSearchResults = false;
			return;
		}

		isSearching = true;
		try {
			searchResults = await searchFeatures({
				searchQuery: query,
				projectId: $globalMapView ? '' : projectId
			});
			filterQuery = '';
			activeIndex = -1;
			showSearchResults = true;
		} catch (error) {
			console.error('Search error:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Search error',
				extraData: {
					from: 'SearchPanel.debouncedSearch',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_search_failed()
			});
			onSearchError(error);
		} finally {
			isSearching = false;
		}
	}, 300);

	/** Searches for what is typed in the input. */
	function handleSearch() {
		debouncedSearch(searchQuery);
	}

	/**
	 * Handle result item click
	 * @param result - Selected result item
	 */
	async function handleResultClick(result: SearchResult) {
		if (!result || !olMapInstance) return;

		const { type, value } = result;
		registerStorageProjection(page.data.srid, page.data.proj4Def);

		try {
			if (type === 'conduit') {
				await handleConduitSelect(value);
				return;
			}

			const feature = await getFeatureDetails({
				featureType: type,
				featureUuid: value,
				projectId: $globalMapView ? '' : projectId
			});

			const geometry = await parseFeatureGeometry(
				feature,
				storageProjection(page.data.srid),
				olMapInstance.getView().getProjection().getCode()
			);

			if (!geometry) {
				console.error('Failed to parse feature geometry');
				globalToaster.error({
					title: m.title_feature_found(),
					description: m.message_error_search_failed()
				});
				return;
			}

			if (!highlightLayer) {
				const highlightStyle = createSearchHighlightStyle(trenchColorSelected);
				highlightLayer = await createHighlightLayer(highlightStyle);
				olMapInstance.addLayer(highlightLayer);
			}

			const [{ default: Feature }] = await Promise.all([import('ol/Feature')]);

			const highlightFeature = new Feature(geometry);
			highlightFeature.setId(feature.id);

			highlightLayer.getSource()!.clear();
			await zoomToFeature(olMapInstance, geometry, highlightLayer);

			searchQuery = '';
			searchResults = [];
			showSearchResults = false;

			globalToaster.success({
				title: m.title_feature_found()
			});

			onFeatureSelect(feature);
		} catch (error) {
			console.error('Error fetching feature details:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching feature details',
				extraData: {
					from: 'SearchPanel.handleResultClick',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.title_feature_found(),
				description: m.message_error_search_failed()
			});
			onSearchError(error);
		}
	}

	/**
	 * Handle conduit selection - zooms to all trenches containing the conduit
	 * @param conduitUuid - UUID of the selected conduit
	 */
	async function handleConduitSelect(conduitUuid: string) {
		if (!olMapInstance) return;
		registerStorageProjection(page.data.srid, page.data.proj4Def);
		try {
			const { trenches, trenchUuids } = await getConduitTrenches(conduitUuid);

			if (trenches.length === 0) {
				globalToaster.warning({
					title: m.form_conduit({ count: 1 }),
					description: m.message_no_conduits_found()
				});
				return;
			}

			const rawGeometries = await parseMultipleFeatureGeometries(
				trenches,
				storageProjection(page.data.srid),
				olMapInstance.getView().getProjection().getCode()
			);
			const geometries = rawGeometries.filter(
				(g): g is import('ol/geom/Geometry').default => g !== undefined
			);

			if (!highlightLayer) {
				const highlightStyle = createSearchHighlightStyle(trenchColorSelected);
				highlightLayer = await createHighlightLayer(highlightStyle);
				olMapInstance.addLayer(highlightLayer);
			}

			highlightLayer.getSource()!.clear();
			await zoomToMultipleFeatures(olMapInstance, geometries, highlightLayer, {
				maxZoom: 17
			});

			searchQuery = '';
			searchResults = [];
			showSearchResults = false;

			globalToaster.success({
				title: m.title_feature_found(),
				description: `${trenches.length} ${m.nav_trench()}`
			});

			onFeatureSelect({
				type: 'conduit',
				uuid: conduitUuid,
				trenches,
				trenchUuids
			});
		} catch (error) {
			console.error('Error fetching conduit trenches:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching conduit trenches',
				extraData: {
					from: 'SearchPanel.handleConduitSelect',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_search_failed()
			});
			onSearchError(error);
		}
	}

	/** Empties the search, closes the list and removes the map highlight. */
	export function clearSearch() {
		searchQuery = '';
		searchResults = [];
		showSearchResults = false;
		if (highlightLayer && highlightLayer.getSource()) {
			highlightLayer.getSource()!.clear();
		}
	}

	/**
	 * Gives the layer the found feature blinks on.
	 * @returns The highlight layer, or undefined before the first selection created it.
	 */
	export function getHighlightLayer() {
		return highlightLayer;
	}
</script>

<div class="search-panel">
	<SearchInput
		bind:value={searchQuery}
		onSearch={handleSearch}
		onkeydown={handleListKeydown}
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={isListOpen}
		{...comboboxAttributes}
	/>

	{#if isListOpen}
		<div class="results-container" transition:fly={{ y: -8, duration: 200, easing: cubicOut }}>
			<div class="results-header">
				<span class="results-count">{filteredResults.length}</span>
				<span class="results-label"
					>{searchResults.length > filteredResults.length
						? `/ ${searchResults.length}`
						: `${m.common_results({ count: searchResults.length })}`}</span
				>
				{#if searchResults.length >= FILTER_THRESHOLD}
					<input
						type="text"
						class="filter-input"
						placeholder={m.common_filter()}
						bind:value={filterQuery}
						oninput={() => (activeIndex = -1)}
						onkeydown={handleListKeydown}
						{...comboboxAttributes}
					/>
				{/if}
			</div>
			<ul
				class="results-list"
				id={listboxId}
				role="listbox"
				aria-label={m.common_results({ count: filteredResults.length })}
			>
				{#each filteredResults as result, index (result.value)}
					{@const config = TYPE_CONFIG[result.type] || TYPE_CONFIG.node}
					{@const context = resultContext(result)}
					<li
						class="result-item"
						role="none"
						style="animation-delay: {index * 30}ms"
						transition:fade={{ duration: 150 }}
					>
						<button
							type="button"
							role="option"
							id={optionId(index)}
							aria-selected={index === activeIndex}
							tabindex="-1"
							class="result-button"
							class:active={index === activeIndex}
							onclick={() => handleResultClick(result)}
							onmouseenter={() => (activeIndex = index)}
						>
							<span class="result-name">{result.label}</span>
							<span class="result-meta">
								<span
									class="type-badge {config.bg} {config.text} {config.darkBg} {config.darkText}"
								>
									{config.getLabel()}
								</span>
								{#if context}
									<span class="result-detail">{context}</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if filteredResults.length === 0 && filterQuery.trim()}
				<div class="no-results">
					{m.common_no_results()}
				</div>
			{/if}
		</div>
	{/if}

	{#if isSearching}
		<div class="loading-container" transition:fade={{ duration: 150 }}>
			<div class="loading-dots">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
			</div>
			<span class="loading-text">{m.common_searching()}</span>
		</div>
	{/if}
</div>

<style>
	.search-panel {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.results-container {
		background: var(--color-surface-50);
		border: 1.5px solid var(--color-surface-200);
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -2px rgba(0, 0, 0, 0.1);
	}

	:global([data-mode='dark']) .results-container {
		background: var(--color-surface-900);
		border-color: var(--color-surface-700);
	}

	.results-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--color-surface-200);
		background: var(--color-surface-100);
	}

	:global([data-mode='dark']) .results-header {
		background: var(--color-surface-800);
		border-color: var(--color-surface-700);
	}

	.results-count {
		font-weight: 700;
		font-size: 13px;
		color: #f59e0b;
	}

	.results-label {
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--color-surface-500);
	}

	.filter-input {
		margin-left: auto;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--color-surface-300);
		border-radius: 6px;
		background: var(--color-surface-50);
		color: var(--color-surface-900);
		outline: none;
		width: 120px;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.filter-input::placeholder {
		color: var(--color-surface-400);
	}

	.filter-input:focus {
		border-color: #f59e0b;
		box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
	}

	:global([data-mode='dark']) .filter-input {
		background: var(--color-surface-800);
		border-color: var(--color-surface-600);
		color: var(--color-surface-100);
	}

	:global([data-mode='dark']) .filter-input::placeholder {
		color: var(--color-surface-500);
	}

	.no-results {
		padding: 16px;
		text-align: center;
		font-size: 13px;
		color: var(--color-surface-500);
	}

	.results-list {
		list-style: none;
		margin: 0;
		padding: 6px;
		max-height: 60dvh;
		overflow-y: auto;
	}

	.result-item {
		opacity: 0;
		animation: fadeSlideIn 0.25s ease-out forwards;
	}

	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.result-button {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s ease;
	}

	.result-button:hover,
	.result-button.active {
		background: var(--color-surface-100);
	}

	:global([data-mode='dark']) .result-button:hover,
	:global([data-mode='dark']) .result-button.active {
		background: var(--color-surface-800);
	}

	/* The full name is the only thing telling near-identical hits apart, so it
	   wraps instead of truncating; `anywhere` also breaks "Sterup,Westerstraße". */
	.result-name {
		font-size: 14px;
		font-weight: 500;
		line-height: 1.35;
		color: var(--color-surface-900);
		overflow-wrap: anywhere;
	}

	:global([data-mode='dark']) .result-name {
		color: var(--color-surface-100);
	}

	.result-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.type-badge {
		flex-shrink: 0;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.result-detail {
		min-width: 0;
		font-size: 12px;
		color: var(--color-surface-600);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global([data-mode='dark']) .result-detail {
		color: var(--color-surface-400);
	}

	.loading-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 16px;
		background: var(--color-surface-50);
		border: 1.5px solid var(--color-surface-200);
		border-radius: 12px;
	}

	:global([data-mode='dark']) .loading-container {
		background: var(--color-surface-900);
		border-color: var(--color-surface-700);
	}

	.loading-dots {
		display: flex;
		gap: 4px;
	}

	.dot {
		width: 8px;
		height: 8px;
		background: #f59e0b;
		border-radius: 50%;
		animation: pulse 1.2s ease-in-out infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.15s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.loading-text {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-surface-500);
	}

	@media (min-width: 640px) {
		.results-header {
			padding: 8px 12px;
		}

		.results-list {
			max-height: 320px;
			padding: 4px;
		}

		.result-button {
			padding: 8px 10px;
		}

		.result-name {
			font-size: 13px;
		}

		.loading-container {
			padding: 12px;
		}
	}
</style>
