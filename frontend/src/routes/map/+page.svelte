<script>
	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import Map from '$lib/components/Map.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { trenchColor, trenchColorSelected } from '$lib/stores/store';
	import { onDestroy } from 'svelte';
	import { selectedProject } from '$lib/stores/store';
	import { enhance } from '$app/forms';
	import { parse } from 'devalue';

	// OpenLayers
	import 'ol/ol.css';
	import Overlay from 'ol/Overlay';

	// Map utilities
	import {
		createTrenchLayer,
		createAddressLayer,
		createNodeLayer,
		createSelectionLayer,
		createTrenchTileSource,
		createAddressTileSource,
		createNodeTileSource
	} from '$lib/map';

	// Search utilities
	import {
		createHighlightLayer,
		createHighlightStyle,
		parseFeatureGeometry,
		zoomToFeature,
		debounce
	} from '$lib/map/searchUtils';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// TODO: Create AbortController for the fetch request

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// State for OpenLayers objects
	let vectorTileLayer = $state();
	let addressLayer = $state();
	let nodeLayer = $state();
	let selectionLayer = $state();
	let addressSelectionLayer = $state();
	let nodeSelectionLayer = $state();
	let olMapInstance = $state();
	let popupOverlay = $state();
	let selectionStore = $state({});

	// Search state
	let searchQuery = $state('');
	let searchResults = $state([]);
	let isSearching = $state(false);
	let showSearchResults = $state(false);
	let highlightLayer = $state();

	// Error handler for tile loading
	function handleTileError(message, description) {
		toaster.create({
			type: 'error',
			message: message,
			description: description
		});
	}

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
					const highlightStyle = await createHighlightStyle($trenchColorSelected);
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
		}
	}

	// Create tile sources and layers
	let tileSource, addressTileSource, nodeTileSource;

	try {
		tileSource = createTrenchTileSource($selectedProject, handleTileError);
		addressTileSource = createAddressTileSource($selectedProject, handleTileError);
		nodeTileSource = createNodeTileSource($selectedProject, handleTileError);

		vectorTileLayer = createTrenchLayer(
			$selectedProject,
			$trenchColor,
			m.trench(),
			handleTileError
		);
		addressLayer = createAddressLayer($selectedProject, m.address(), handleTileError);
		nodeLayer = createNodeLayer($selectedProject, m.node(), handleTileError);
	} catch (error) {
		toaster.error({
			title: m.error_initializing_map_tiles(),
			description: error.message || 'Could not set up the tile layer.'
		});
		vectorTileLayer = undefined;
		tileSource = undefined;
		addressLayer = undefined;
		addressTileSource = undefined;
		nodeLayer = undefined;
		nodeTileSource = undefined;
	}

	$effect(() => {
		if (tileSource) {
			tileSource.refresh();
		}
		if (addressTileSource) {
			addressTileSource.refresh();
		}
		if (nodeTileSource) {
			nodeTileSource.refresh();
		}
	});

	// Handler for the map ready event
	function handleMapReady(event) {
		olMapInstance = event.detail.map;
		initializeMapInteractions();
	}

	// Function to initialize map interactions
	function initializeMapInteractions() {
		if (!olMapInstance || !vectorTileLayer || !tileSource) return;

		selectionLayer = createSelectionLayer(tileSource, $trenchColorSelected, () => selectionStore);
		olMapInstance.addLayer(selectionLayer);

		addressSelectionLayer = createSelectionLayer(
			addressTileSource,
			$trenchColorSelected,
			() => selectionStore
		);
		olMapInstance.addLayer(addressSelectionLayer);

		nodeSelectionLayer = createSelectionLayer(
			nodeTileSource,
			$trenchColorSelected,
			() => selectionStore
		);
		olMapInstance.addLayer(nodeSelectionLayer);

		const popupContainer = document.getElementById('popup');
		if (!popupContainer) {
			console.error('Popup container element not found!');
			return;
		}
		const content = document.getElementById('popup-content');
		const closer = document.getElementById('popup-closer');
		popupOverlay = new Overlay({
			element: popupContainer,
			autoPan: {
				animation: { duration: 250 }
			}
		});
		olMapInstance.addOverlay(popupOverlay);

		if (closer) {
			closer.onclick = () => {
				popupOverlay.setPosition(undefined);
				selectionStore = {};
				if (selectionLayer) selectionLayer.changed();
				if (addressSelectionLayer) addressSelectionLayer.changed();
				if (nodeSelectionLayer) nodeSelectionLayer.changed();
				closer.blur();
				return false;
			};
		}

		// Listen for map clicks to select features
		olMapInstance.on('click', (event) => {
			if (!vectorTileLayer || !olMapInstance) return;

			let clickedFeatures = [];
			olMapInstance.forEachFeatureAtPixel(
				event.pixel,
				(feature, layer) => {
					clickedFeatures.push(feature);
				},
				{
					hitTolerance: 10,
					layerFilter: (layer) =>
						layer === vectorTileLayer || layer === addressLayer || layer === nodeLayer // Check trench, address, and node layers
				}
			);

			if (clickedFeatures.length > 0) {
				highlightLayer.getSource().clear();
				const feature = clickedFeatures[0];
				const featureId = feature.getId();

				if (featureId) {
					selectionStore = {};
					selectionStore[featureId] = feature;

					const properties = feature.getProperties();

					let html = '<ul>';
					for (const [key, value] of Object.entries(properties)) {
						if (typeof value !== 'object' && key !== 'layer' && key !== 'source') {
							if (data.alias[key]) {
								html += `<li><strong>${data.alias[key]}:</strong> ${value}</li>`;
							} else {
								html += `<li><strong>${key}:</strong> ${value}</li>`;
							}
						}
					}
					html += '</ul>';
					if (content) content.innerHTML = html;
					popupOverlay.setPosition(event.coordinate);
				} else {
					selectionStore = {};
					popupOverlay.setPosition(undefined);
				}
			} else {
				selectionStore = {};
				popupOverlay.setPosition(undefined);
			}
			if (selectionLayer) selectionLayer.changed();
			if (addressSelectionLayer) addressSelectionLayer.changed();
			if (nodeSelectionLayer) nodeSelectionLayer.changed();
		});
	}

	onDestroy(() => {
		if (olMapInstance) {
			if (popupOverlay) olMapInstance.removeOverlay(popupOverlay);
			if (selectionLayer) olMapInstance.removeLayer(selectionLayer);
			if (addressSelectionLayer) olMapInstance.removeLayer(addressSelectionLayer);
			if (nodeSelectionLayer) olMapInstance.removeLayer(nodeSelectionLayer);
			if (addressLayer) olMapInstance.removeLayer(addressLayer);
			if (nodeLayer) olMapInstance.removeLayer(nodeLayer);
			if (highlightLayer) olMapInstance.removeLayer(highlightLayer);
		}
		olMapInstance = undefined;
		popupOverlay = undefined;
		selectionStore = {};
		selectionLayer = undefined;
		addressSelectionLayer = undefined;
		nodeSelectionLayer = undefined;

		if (vectorTileLayer && vectorTileLayer.getSource()) {
			vectorTileLayer.getSource().dispose();
		}
		vectorTileLayer = undefined;

		if (addressLayer && addressLayer.getSource()) {
			addressLayer.getSource().dispose();
		}
		addressLayer = undefined;
		addressTileSource = undefined;

		if (nodeLayer && nodeLayer.getSource()) {
			nodeLayer.getSource().dispose();
		}
		nodeLayer = undefined;
		nodeTileSource = undefined;

		if (highlightLayer && highlightLayer.getSource()) {
			highlightLayer.getSource().dispose();
		}
		highlightLayer = undefined;
	});

	if (data.error) {
		toaster.error({
			title: m.error_loading_map_features(),
			description: data.error
		});
	}
</script>

<svelte:head>
	<title>{m.map()}</title>
</svelte:head>

<Toaster {toaster}></Toaster>

<div class="map-container relative h-full w-full">
	<!-- Search Controls -->
	<div class="absolute top-3 left-15 right-4 z-10 flex flex-col space-y-2 max-w-md">
		<div class="bg-surface-50-950 rounded-lg border border-surface-200-800 shadow-lg p-3">
			<SearchInput bind:value={searchQuery} onSearch={handleSearch} />

			{#if showSearchResults && searchResults.length > 0}
				<div class="mt-2">
					<GenericCombobox
						data={searchResults}
						placeholder="Select a feature..."
						loading={isSearching}
						onValueChange={handleFeatureSelect}
						classes="touch-manipulation text-sm"
						zIndex="20"
					/>
				</div>
			{/if}

			{#if isSearching}
				<div class="mt-2 text-sm text-surface-600-400">Searching...</div>
			{/if}
		</div>
	</div>
	{#if data.error && !vectorTileLayer}
		<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
			<p>Error loading initial map data: {data.error}</p>
		</div>
	{:else if vectorTileLayer}
		<div class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full">
			<Map
				className="rounded-lg overflow-hidden"
				layers={[
					vectorTileLayer,
					...(addressLayer ? [addressLayer] : []),
					...(nodeLayer ? [nodeLayer] : []),
					...(selectionLayer ? [selectionLayer] : []),
					...(addressSelectionLayer ? [addressSelectionLayer] : []),
					...(nodeSelectionLayer ? [nodeSelectionLayer] : []),
					...(highlightLayer ? [highlightLayer] : [])
				]}
				on:ready={handleMapReady}
			/>
			<div id="popup" class="ol-popup bg-primary-500 rounded-lg border-2 border-primary-600">
				<!-- svelte-ignore a11y_invalid_attribute -->
				<a href="#" id="popup-closer" class="ol-popup-closer" aria-label="Close popup"></a>
				<div id="popup-content"></div>
			</div>
		</div>
	{:else}
		<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
			<p>Map tiles could not be loaded. Please check the connection or configuration.</p>
		</div>
	{/if}
</div>

<style>
	.ol-popup {
		position: absolute;
		padding: 8px;
		transform: translate(-50%, -100%);
		pointer-events: auto;
		min-width: 180px;
		z-index: 10;
	}
	.ol-popup-closer {
		position: absolute;
		top: 4px;
		right: 8px;
		text-decoration: none;
		font-weight: bold;
		cursor: pointer;
		color: #fff;
	}

	#popup-content {
		padding: 5px;
		color: #fff;
		max-height: 200px;
		overflow-y: auto;
	}
</style>
