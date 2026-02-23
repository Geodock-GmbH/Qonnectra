<script>
	import { getContext } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import { parse } from 'devalue';
	import Fuse from 'fuse.js';

	import { m } from '$lib/paraglide/messages';

	import {
		createHighlightLayer,
		createHighlightStyle,
		debounce,
		parseFeatureGeometry,
		parseMultipleFeatureGeometries,
		zoomToFeature,
		zoomToMultipleFeatures
	} from '$lib/map/searchUtils';
	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import SearchInput from './SearchInput.svelte';

	let {
		olMapInstance = null,
		trenchColorSelected = '#ff0000',
		alias = {},
		onFeatureSelect = () => {},
		onSearchError = () => {}
	} = $props();

	const mapManagers = getContext('mapManagers');
	const selectionManager = mapManagers?.selectionManager;

	let searchQuery = $state('');
	let searchResults = $state([]);
	let filterQuery = $state('');
	let isSearching = $state(false);
	let showSearchResults = $state(false);
	let highlightLayer = $state();

	const FILTER_THRESHOLD = 10;

	const fuse = $derived(
		new Fuse(searchResults, {
			keys: ['label'],
			threshold: 0.3
		})
	);

	let filteredResults = $derived.by(() => {
		if (!filterQuery.trim()) return searchResults;
		const results = fuse.search(filterQuery);
		return results.length > 0 ? results.map((r) => r.item) : searchResults;
	});

	const TYPE_CONFIG = {
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
	 * Get display name from label by removing the type suffix
	 * @param {string} label - Full label with type suffix
	 * @returns {string} Clean display name
	 */
	function getDisplayName(label) {
		return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
	}

	const debouncedSearch = debounce(async (query) => {
		if (!query.trim()) {
			searchResults = [];
			showSearchResults = false;
			return;
		}

		isSearching = true;
		try {
			const formData = new FormData();
			formData.append('searchQuery', query);
			formData.append('projectId', $selectedProject);

			const response = await fetch('?/searchFeatures', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				let rawResponse = await response.json();
				let parsedData = parse(rawResponse.data);

				searchResults = parsedData;
				filterQuery = '';
				showSearchResults = true;
			} else {
				console.error('Failed to fetch search results:', await response.text());
				searchResults = null;
				showSearchResults = false;
			}
		} catch (error) {
			console.error('Search error:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_search_failed()
			});
			onSearchError(error);
		} finally {
			isSearching = false;
		}
	}, 300);

	function handleSearch() {
		debouncedSearch(searchQuery);
	}

	/**
	 * Handle result item click
	 * @param {Object} result - Selected result item
	 */
	async function handleResultClick(result) {
		if (!result || !olMapInstance) return;

		const { type, value } = result;

		try {
			if (type === 'conduit') {
				await handleConduitSelect(value);
				return;
			}

			const formData = new FormData();
			formData.append('featureType', type);
			formData.append('featureUuid', value);
			formData.append('projectId', $selectedProject);

			const response = await fetch('?/getFeatureDetails', {
				method: 'POST',
				body: formData
			});

			const jsonResult = await response.json();
			let parsedData = parse(jsonResult.data);

			if (
				jsonResult.type === 'success' &&
				parsedData?.success &&
				parsedData?.feature &&
				parsedData.feature.length > 0
			) {
				const feature = parsedData.feature[0];

				const geometry = await parseFeatureGeometry(
					feature,
					'EPSG:25832',
					olMapInstance.getView().getProjection()
				);

				if (!highlightLayer) {
					const highlightStyle = await createHighlightStyle(trenchColorSelected);
					highlightLayer = await createHighlightLayer(highlightStyle);
					olMapInstance.addLayer(highlightLayer);
				}

				const [{ default: Feature }] = await Promise.all([import('ol/Feature')]);

				const highlightFeature = new Feature(geometry);
				highlightFeature.setId(feature.id);

				highlightLayer.getSource().clear();
				await zoomToFeature(olMapInstance, geometry, highlightLayer);

				searchQuery = '';
				searchResults = [];
				showSearchResults = false;

				globalToaster.success({
					title: m.title_feature_found()
				});

				onFeatureSelect(feature);
			} else {
				console.error('Invalid response structure:', parsedData);
				globalToaster.error({
					title: m.title_feature_found(),
					description: m.message_error_search_failed()
				});
			}
		} catch (error) {
			console.error('Error fetching feature details:', error);
			globalToaster.error({
				title: m.title_feature_found(),
				description: m.message_error_search_failed()
			});
			onSearchError(error);
		}
	}

	/**
	 * Handle conduit selection - zooms to all trenches containing the conduit
	 * @param {string} conduitUuid - UUID of the selected conduit
	 */
	async function handleConduitSelect(conduitUuid) {
		try {
			const formData = new FormData();
			formData.append('conduitUuid', conduitUuid);

			const response = await fetch('?/getConduitTrenches', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			let parsedData = parse(result.data);

			if (result.type === 'success' && parsedData?.success) {
				if (!parsedData.trenches || parsedData.trenches.length === 0) {
					globalToaster.warning({
						title: m.form_conduit({ count: 1 }),
						description: m.message_no_conduits_found()
					});
					return;
				}

				const geometries = await parseMultipleFeatureGeometries(
					parsedData.trenches,
					'EPSG:25832',
					olMapInstance.getView().getProjection()
				);

				if (!highlightLayer) {
					const highlightStyle = await createHighlightStyle(trenchColorSelected);
					highlightLayer = await createHighlightLayer(highlightStyle);
					olMapInstance.addLayer(highlightLayer);
				}

				highlightLayer.getSource().clear();
				await zoomToMultipleFeatures(olMapInstance, geometries, highlightLayer, {
					maxZoom: 17
				});

				searchQuery = '';
				searchResults = [];
				showSearchResults = false;

				globalToaster.success({
					title: m.title_feature_found(),
					description: `${parsedData.trenches.length} ${m.nav_trench()}`
				});

				onFeatureSelect({
					type: 'conduit',
					uuid: conduitUuid,
					trenches: parsedData.trenches,
					trenchUuids: parsedData.trenchUuids
				});
			} else {
				console.error('Invalid response structure:', parsedData);
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_search_failed()
				});
			}
		} catch (error) {
			console.error('Error fetching conduit trenches:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_search_failed()
			});
			onSearchError(error);
		}
	}

	export function clearSearch() {
		searchQuery = '';
		searchResults = [];
		showSearchResults = false;
		if (highlightLayer && highlightLayer.getSource()) {
			highlightLayer.getSource().clear();
		}
	}

	export function getHighlightLayer() {
		return highlightLayer;
	}
</script>

<div class="search-panel">
	<SearchInput bind:value={searchQuery} onSearch={handleSearch} />

	{#if showSearchResults && searchResults && searchResults.length > 0 && !isSearching}
		<div class="results-container" transition:fly={{ y: -8, duration: 200, easing: cubicOut }}>
			<div class="results-header">
				<span class="results-count">{filteredResults.length}</span>
				<span class="results-label"
					>{searchResults.length > filteredResults.length
						? `/ ${searchResults.length}`
						: 'results'}</span
				>
				{#if searchResults.length >= FILTER_THRESHOLD}
					<input
						type="text"
						class="filter-input"
						placeholder={m.common_filter ? m.common_filter() : 'Filter...'}
						bind:value={filterQuery}
					/>
				{/if}
			</div>
			<ul class="results-list">
				{#each filteredResults as result, index (result.value)}
					{@const config = TYPE_CONFIG[result.type] || TYPE_CONFIG.node}
					<li
						class="result-item"
						style="animation-delay: {index * 30}ms"
						transition:fade={{ duration: 150 }}
					>
						<button type="button" class="result-button" onclick={() => handleResultClick(result)}>
							<span class="type-badge {config.bg} {config.text} {config.darkBg} {config.darkText}">
								{config.getLabel()}
							</span>
							<span class="result-name">{getDisplayName(result.label)}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if filteredResults.length === 0 && filterQuery.trim()}
				<div class="no-results">
					{m.common_no_results ? m.common_no_results() : 'No matches'}
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
		max-height: 50vh;
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
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition:
			background-color 0.15s ease,
			transform 0.15s ease;
	}

	.result-button:hover {
		background: var(--color-surface-100);
		transform: translateY(-1px);
	}

	:global([data-mode='dark']) .result-button:hover {
		background: var(--color-surface-800);
	}

	.result-button:active {
		transform: translateY(0);
	}

	.type-badge {
		flex-shrink: 0;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.result-name {
		flex: 1;
		font-size: 14px;
		font-weight: 500;
		color: var(--color-surface-900);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global([data-mode='dark']) .result-name {
		color: var(--color-surface-100);
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
			max-height: 240px;
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
