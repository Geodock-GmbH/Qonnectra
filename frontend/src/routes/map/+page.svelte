<script>
	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import Map from '$lib/components/Map.svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { trenchColor, trenchColorSelected } from '$lib/stores/store';
	import { onDestroy, onMount } from 'svelte';
	import { selectedProject } from '$lib/stores/store';

	// OpenLayers
	import 'ol/ol.css';
	import Fill from 'ol/style/Fill.js';
	import Stroke from 'ol/style/Stroke.js';
	import { Style, Circle as CircleStyle } from 'ol/style';
	import Overlay from 'ol/Overlay';
	import MVT from 'ol/format/MVT.js';
	import VectorTileLayer from 'ol/layer/VectorTile.js';
	import VectorTileSource from 'ol/source/VectorTile.js';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// TODO: Create AbortController for the fetch request

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// State for OpenLayers objects
	let vectorTileLayer = $state();
	let addressLayer = $state(); // New address layer
	let nodeLayer = $state(); // New node layer
	let selectionLayer = $state(); // Layer for displaying selected features
	let olMapInstance = $state();
	let popupOverlay = $state();
	let selectionStore = $state({}); // Stores the ID of the selected feature { [featureId]: feature }

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

	// Style for all features (will be applied to the VectorTileLayer)
	const trenchStyle = new Style({
		fill: new Fill({
			color: $trenchColor
		}),
		stroke: new Stroke({
			color: $trenchColor,
			width: 2
		}),
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: $trenchColor }),
			stroke: new Stroke({ color: $trenchColor, width: 2 })
		})
	});

	// Style for selected features
	const selectedStyle = new Style({
		fill: new Fill({
			color: $trenchColorSelected
		}),
		stroke: new Stroke({
			color: $trenchColorSelected,
			width: 3
		}),
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: $trenchColorSelected }),
			stroke: new Stroke({ color: $trenchColorSelected, width: 2 })
		})
	});

	// Style for address points
	const addressStyle = new Style({
		image: new CircleStyle({
			radius: 6,
			fill: new Fill({ color: '#ff6b35' }), // Orange color for addresses
			stroke: new Stroke({ color: '#ffffff', width: 1 })
		})
	});

	// Style for node points
	const nodeStyle = new Style({
		image: new CircleStyle({
			radius: 4,
			fill: new Fill({ color: '#2563eb' }), // Blue color for nodes
			stroke: new Stroke({ color: '#ffffff', width: 1 })
		})
	});

	// Create the Vector Tile Layer and Source
	// This runs once when the component script is executed
	let tileSource; // Define tileSource here to be accessible by selectionLayer
	let addressTileSource; // Define addressTileSource for the address layer
	let nodeTileSource; // Define nodeTileSource for the node layer
	try {
		tileSource = new VectorTileSource({
			format: new MVT({
				idProperty: 'uuid'
			}),
			tileUrlFunction: (tileCoord) => {
				const [z, x, y] = tileCoord;
				const projectId = parseInt($selectedProject, 10);
				if (isNaN(projectId)) {
					return undefined; // Don't load tiles if no project is selected.
				}

				return `${PUBLIC_API_URL}ol_trench_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
			},
			tileLoadFunction: (tile, url) => {
				if (!url) {
					tile.setState(4); // EMPTY
					return;
				}
				tile.setLoader((extent, resolution, projection) => {
					fetch(url, {
						credentials: 'include'
					})
						.then((response) => {
							if (!response.ok) {
								throw new Error(`Failed to load tile: ${response.statusText}`);
							}
							return response.arrayBuffer();
						})
						.then((data) => {
							const format = tile.getFormat();
							const features = format.readFeatures(data, {
								extent: extent,
								featureProjection: projection
							});
							tile.setFeatures(features);
						})
						.catch((error) => {
							console.error('Error loading vector tile:', error);
							tile.setState(3); // 3 corresponds to ol.TileState.ERROR
							toaster.create({
								type: 'error',
								message: 'Error loading a map tile',
								description: error.message || 'Could not fetch tile data.'
							});
						});
				});
			}
		});

		vectorTileLayer = new VectorTileLayer({
			source: tileSource,
			style: trenchStyle,
			renderMode: 'vector' // Important for getFeatures to work reliably
		});

		// Create the Address Tile Source
		addressTileSource = new VectorTileSource({
			format: new MVT({
				idProperty: 'uuid' // Use 'uuid' as the feature ID
			}),
			tileUrlFunction: (tileCoord) => {
				const [z, x, y] = tileCoord;
				const projectId = parseInt($selectedProject, 10);
				if (isNaN(projectId)) {
					return undefined; // Don't load tiles if no project is selected.
				}

				return `${PUBLIC_API_URL}ol_address_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
			},
			tileLoadFunction: (tile, url) => {
				if (!url) {
					tile.setState(4); // EMPTY
					return;
				}
				tile.setLoader((extent, resolution, projection) => {
					fetch(url, {
						credentials: 'include'
					})
						.then((response) => {
							if (!response.ok) {
								throw new Error(`Failed to load address tile: ${response.statusText}`);
							}
							return response.arrayBuffer();
						})
						.then((data) => {
							const format = tile.getFormat();
							const features = format.readFeatures(data, {
								extent: extent,
								featureProjection: projection
							});
							tile.setFeatures(features);
						})
						.catch((error) => {
							console.error('Error loading address vector tile:', error);
							tile.setState(3); // 3 corresponds to ol.TileState.ERROR
							toaster.create({
								type: 'error',
								message: 'Error loading address tile',
								description: error.message || 'Could not fetch address tile data.'
							});
						});
				});
			}
		});

		addressLayer = new VectorTileLayer({
			source: addressTileSource,
			style: addressStyle,
			renderMode: 'vector'
		});

		// Create the Node Tile Source
		nodeTileSource = new VectorTileSource({
			format: new MVT({
				idProperty: 'uuid'
			}),
			tileUrlFunction: (tileCoord) => {
				const [z, x, y] = tileCoord;
				const projectId = parseInt($selectedProject, 10);
				if (isNaN(projectId)) {
					return undefined; // Don't load tiles if no project is selected.
				}

				return `${PUBLIC_API_URL}ol_node_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
			},
			tileLoadFunction: (tile, url) => {
				if (!url) {
					tile.setState(4); // EMPTY
					return;
				}
				tile.setLoader((extent, resolution, projection) => {
					fetch(url, {
						credentials: 'include'
					})
						.then((response) => {
							if (!response.ok) {
								throw new Error(`Failed to load node tile: ${response.statusText}`);
							}
							return response.arrayBuffer();
						})
						.then((data) => {
							const format = tile.getFormat();
							const features = format.readFeatures(data, {
								extent: extent,
								featureProjection: projection
							});
							tile.setFeatures(features);
						})
						.catch((error) => {
							console.error('Error loading node vector tile:', error);
							tile.setState(3); // 3 corresponds to ol.TileState.ERROR
							toaster.create({
								type: 'error',
								message: 'Error loading node tile',
								description: error.message || 'Could not fetch node tile data.'
							});
						});
				});
			}
		});

		nodeLayer = new VectorTileLayer({
			source: nodeTileSource,
			style: nodeStyle,
			renderMode: 'vector'
		});
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

	// Handler for the map ready event
	function handleMapReady(event) {
		olMapInstance = event.detail.map;
		initializeMapInteractions(); // Call this after map is ready
	}

	// Function to initialize map interactions (click listener, popup, selection layer)
	function initializeMapInteractions() {
		if (!olMapInstance || !vectorTileLayer || !tileSource) return;

		// Create the selection layer
		selectionLayer = new VectorTileLayer({
			renderMode: 'vector',
			source: tileSource, // Use the same source as the main layer
			style: function (feature) {
				if (feature.getId() && selectionStore[feature.getId()]) {
					return selectedStyle;
				}
				return undefined; // Don't render if not selected
			}
		});
		olMapInstance.addLayer(selectionLayer); // Add selection layer to the map

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
				if (selectionLayer) selectionLayer.changed(); // Refresh selection layer
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
							html += `<li><strong>${key}:</strong> ${value}</li>`;
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
			if (selectionLayer) selectionLayer.changed(); // Refresh selection layer

			// The .then() and .catch() structure is not directly applicable here as forEachFeatureAtPixel is synchronous
			// and doesn't return a Promise. Error handling for it would be less direct.
			// If getFeaturesAtPixel itself could throw an error, a try-catch around it would be needed,
			// but typically it doesn't for simple pixel queries.
		});
	}

	onDestroy(() => {
		if (olMapInstance) {
			if (popupOverlay) olMapInstance.removeOverlay(popupOverlay);
			if (selectionLayer) olMapInstance.removeLayer(selectionLayer); // Remove selection layer
			if (addressLayer) olMapInstance.removeLayer(addressLayer); // Remove address layer
			if (nodeLayer) olMapInstance.removeLayer(nodeLayer); // Remove node layer
		}
		olMapInstance = undefined;
		popupOverlay = undefined;
		selectionStore = {};
		if (selectionLayer && selectionLayer.getSource()) {
			// Source is shared, dispose only with the main layer
			// selectionLayer.getSource().dispose(); // NO - source is shared
		}
		selectionLayer = undefined;

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
					...(selectionLayer ? [selectionLayer] : [])
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
		/* Removed border and box-shadow to rely on Tailwind classes from the div */
		transform: translate(-50%, -100%); /* Adjust to keep above pointer */
		pointer-events: auto; /* Allow interaction with popup content */
		min-width: 180px; /* Example min-width */
		/* Ensure popup appears above map features */
		z-index: 10; /* If you have other absolutely positioned elements */
	}
	.ol-popup-closer {
		position: absolute;
		top: 4px;
		right: 8px;
		text-decoration: none;
		font-weight: bold;
		cursor: pointer;
		color: #fff; /* Example: White color for visibility on primary background */
	}
	/* Ensure content area has some padding and text is visible */
	#popup-content {
		padding: 5px;
		color: #fff; /* Example: White text for visibility */
		max-height: 200px; /* Example max height */
		overflow-y: auto; /* Scroll if content overflows */
	}
</style>
