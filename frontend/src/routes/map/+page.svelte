<script>
	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import Map from '$lib/components/Map.svelte';
	import { trenchColor, trenchColorSelected } from '$lib/stores/store';
	import { onDestroy } from 'svelte';
	import { selectedProject } from '$lib/stores/store';

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

	// Error handler for tile loading
	function handleTileError(message, description) {
		toaster.create({
			type: 'error',
			message: message,
			description: description
		});
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
		toaster.create({
			type: 'error',
			message: 'Error initializing map tiles',
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
		initializeMapInteractions(); // Call this after map is ready
	}

	// Function to initialize map interactions (click listener, popup, selection layer)
	function initializeMapInteractions() {
		if (!olMapInstance || !vectorTileLayer || !tileSource) return;

		// Create the selection layers for each layer type
		selectionLayer = createSelectionLayer(tileSource, $trenchColorSelected, () => selectionStore);
		olMapInstance.addLayer(selectionLayer);

		// Create selection layer for addresses
		addressSelectionLayer = createSelectionLayer(
			addressTileSource,
			$trenchColorSelected,
			() => selectionStore
		);
		olMapInstance.addLayer(addressSelectionLayer);

		// Create selection layer for nodes
		nodeSelectionLayer = createSelectionLayer(
			nodeTileSource,
			$trenchColorSelected,
			() => selectionStore
		);
		olMapInstance.addLayer(nodeSelectionLayer);

		// Create and add a popup overlay
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
				selectionStore = {}; // Clear selection on popup close
				// Refresh all selection layers
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
					// The callback is called for each feature found at the pixel (within hitTolerance)
					clickedFeatures.push(feature);
				},
				{
					hitTolerance: 10,
					layerFilter: (layer) =>
						layer === vectorTileLayer || layer === addressLayer || layer === nodeLayer // Check trench, address, and node layers
				}
			);

			if (clickedFeatures.length > 0) {
				const feature = clickedFeatures[0]; // Select the first feature found
				const featureId = feature.getId();

				if (featureId) {
					// Single selection: clear previous, select new
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
					// No feature with ID found, clear selection
					selectionStore = {};
					popupOverlay.setPosition(undefined);
				}
			} else {
				// No features found at click, clear selection
				selectionStore = {};
				popupOverlay.setPosition(undefined);
			}
			// Refresh all selection layers
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
		}
		olMapInstance = undefined;
		popupOverlay = undefined;
		selectionStore = {};
		// Selection layers share sources with main layers, so don't dispose sources here
		selectionLayer = undefined;
		addressSelectionLayer = undefined;
		nodeSelectionLayer = undefined;

		if (vectorTileLayer && vectorTileLayer.getSource()) {
			vectorTileLayer.getSource().dispose(); // Dispose the source
		}
		vectorTileLayer = undefined;

		if (addressLayer && addressLayer.getSource()) {
			addressLayer.getSource().dispose(); // Dispose the address source
		}
		addressLayer = undefined;
		addressTileSource = undefined;

		if (nodeLayer && nodeLayer.getSource()) {
			nodeLayer.getSource().dispose(); // Dispose the node source
		}
		nodeLayer = undefined;
		nodeTileSource = undefined;
	});

	if (data.error) {
		toaster.create({
			type: 'error',
			message: m.error_loading_map_features(),
			description: data.error
		});
	}
</script>

<svelte:head>
	<title>{m.map()}</title>
</svelte:head>

<Toaster {toaster}></Toaster>

<div class="map-container relative h-full w-full">
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
					...(nodeSelectionLayer ? [nodeSelectionLayer] : [])
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
