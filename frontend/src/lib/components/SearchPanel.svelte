<script>
	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Components
	import SearchInput from './SearchInput.svelte';
	import GenericCombobox from './GenericCombobox.svelte';

	// Svelte
	import { selectedProject } from '$lib/stores/store';
	import { enhance } from '$app/forms';
	import { parse } from 'devalue';

	// Search utilities
	import {
		createHighlightLayer,
		createHighlightStyle,
		parseFeatureGeometry,
		zoomToFeature,
		debounce
	} from '$lib/map/searchUtils';

	// Props
	let {
		olMapInstance = null,
		trenchColorSelected = '#ff0000',
		alias = {},
		onFeatureSelect = () => {},
		onSearchError = () => {}
	} = $props();

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// Search state
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
			toaster.error({
				title: m.error(),
				description: m.error_search_failed()
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
				highlightLayer.getSource().addFeature(highlightFeature);

				await zoomToFeature(olMapInstance, geometry, highlightLayer);

				searchQuery = '';
				searchResults = [];
				showSearchResults = false;

				toaster.success({
					title: m.feature_found()
				});

				onFeatureSelect(feature);
			} else {
				console.error('Invalid response structure:', parsedData);
				toaster.error({
					title: m.error_feature_not_found()
				});
			}
		} catch (error) {
			console.error('Error fetching feature details:', error);
			toaster.error({
				title: m.error9_feature_not_found()
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

<Toaster {toaster}></Toaster>

<div class="bg-surface-50-950 rounded-lg border border-surface-200-800 shadow-lg p-3 lg:p-4 w-full">
	<SearchInput bind:value={searchQuery} onSearch={handleSearch} />

	{#if showSearchResults && searchResults.length > 0}
		<div class="mt-3 lg:mt-2">
			<GenericCombobox
				data={searchResults}
				placeholder="Select a feature..."
				loading={isSearching}
				onValueChange={handleFeatureSelect}
				classes="touch-manipulation text-base lg:text-sm min-h-[44px] lg:min-h-[36px]"
				contentBase="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg text-base lg:text-sm"
				zIndex="20"
			/>
		</div>
	{/if}

	{#if isSearching}
		<div class="mt-3 lg:mt-2 text-base lg:text-sm text-surface-600-400 flex items-center justify-center lg:justify-start">
			<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500 mr-2"></div>
			Searching...
		</div>
	{/if}
</div>
