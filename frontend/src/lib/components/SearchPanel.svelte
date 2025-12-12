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

				// Also use selectionManager for persistent layer highlighting (if available)
				if (selectionManager && parsedData.trenchUuids) {
					selectionManager.selectMultipleFeatures(parsedData.trenchUuids);
				}

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

<div class="preset-filled-surface-50-950 rounded-lg shadow-lg w-full">
	<SearchInput bind:value={searchQuery} onSearch={handleSearch} />
</div>
<div class="preset-filled-surface-50-950 rounded-lg shadow-lg w-full">
	{#if showSearchResults && searchResults.length > 0 && !isSearching}
		<div class="mt-3 lg:mt-2">
			<GenericCombobox
				data={searchResults}
				placeholder={m.placeholder_select_a_feature()}
				onValueChange={handleFeatureSelect}
				classes="touch-manipulation text-base lg:text-sm min-h-[36px] lg:min-h-[36px]"
				contentBase="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg text-base lg:text-sm"
				zIndex="20"
			/>
		</div>
	{/if}

	{#if isSearching}
		<div
			class="m-3 lg:m-2 text-base lg:text-sm text-surface-600-400 flex items-center justify-center lg:justify-start lg:min-h-[36px]"
		>
			<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500 mr-2"></div>
			{m.common_searching()}
		</div>
	{/if}
</div>
