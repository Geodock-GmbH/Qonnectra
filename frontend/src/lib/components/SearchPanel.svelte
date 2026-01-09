<script>
	import { getContext } from 'svelte';
	import { parse } from 'devalue';

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

	import GenericCombobox from './GenericCombobox.svelte';
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
	let isSearching = $state(false);
	let showSearchResults = $state(false);
	let highlightLayer = $state();

	// Search functions
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

	async function handleFeatureSelect(selectedFeature) {
		if (!selectedFeature || !olMapInstance) return;

		const { type, value, label } = selectedFeature.items[0];

		try {
			if (type === 'conduit') {
				await handleConduitSelect(value);
				return;
			}

			const formData = new FormData();
			formData.append('featureType', type);
			formData.append('featureUuid', value);

			const response = await fetch('?/getFeatureDetails', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			let parsedData = parse(result.data);

			if (
				result.type === 'success' &&
				parsedData?.success &&
				parsedData?.feature &&
				parsedData.feature.length > 0
			) {
				const feature = parsedData.feature[0];

				const geometry = await parseFeatureGeometry(
					feature,
					'EPSG:25832', //TODO: Change to not be hardcoded
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
						title: m.form_conduit(),
						description: m.message_no_conduits_found()
					});
					return;
				}

				// Parse all trench geometries
				const geometries = await parseMultipleFeatureGeometries(
					parsedData.trenches,
					'EPSG:25832',
					olMapInstance.getView().getProjection()
				);

				// Ensure highlight layer exists
				if (!highlightLayer) {
					const highlightStyle = await createHighlightStyle(trenchColorSelected);
					highlightLayer = await createHighlightLayer(highlightStyle);
					olMapInstance.addLayer(highlightLayer);
				}

				highlightLayer.getSource().clear();

				// Zoom to all trenches with blinking animation (features persist after blink)
				await zoomToMultipleFeatures(olMapInstance, geometries, highlightLayer, {
					maxZoom: 17
				});

				// Clear search state
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

	// Expose methods for external control
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

<div class="w-full space-y-2">
	<!-- Search Input -->
	<div class="preset-filled-surface-50-950 rounded-lg shadow-md border border-surface-200-800/50">
		<SearchInput bind:value={searchQuery} onSearch={handleSearch} />
	</div>

	<!-- Search Results -->
	{#if showSearchResults && searchResults.length > 0 && !isSearching}
		<div
			class="preset-filled-surface-50-950 rounded-lg shadow-md border border-surface-200-800/50 p-2 animate-in fade-in slide-in-from-top-1 duration-200 flex items-center"
		>
			<GenericCombobox
				data={searchResults}
				placeholder={m.placeholder_select_a_feature()}
				onValueChange={handleFeatureSelect}
				classes="touch-manipulation text-base sm:text-sm w-full"
				contentBase="max-h-[50vh] sm:max-h-60 overflow-auto touch-manipulation rounded-lg border border-surface-200-800 bg-surface-50-950 shadow-xl text-base sm:text-sm"
				zIndex="20"
			/>
		</div>
	{/if}

	<!-- Loading State -->
	{#if isSearching}
		<div
			class="preset-filled-surface-50-950 rounded-lg shadow-md border border-surface-200-800/50 p-4 sm:p-3"
		>
			<div class="flex items-center justify-center sm:justify-start gap-3">
				<div
					class="animate-spin rounded-full h-5 w-5 sm:h-4 sm:w-4 border-2 border-primary-500 border-t-transparent"
				></div>
				<span class="text-base sm:text-sm text-surface-600-400">{m.common_searching()}</span>
			</div>
		</div>
	{/if}
</div>
