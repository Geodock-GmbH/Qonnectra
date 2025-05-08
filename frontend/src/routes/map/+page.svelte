<script>
	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import Map from '$lib/components/Map.svelte';
	import { m } from '$lib/paraglide/messages';
	import { PUBLIC_MAP_TILES_URL } from '$env/static/public'; // Import for constructing tile URL

	// OpenLayers
	import 'ol/ol.css';
	// REMOVE: import VectorSource from 'ol/source/Vector';
	// REMOVE: import VectorLayer from 'ol/layer/Vector';
	import Fill from 'ol/style/Fill.js';
	import Stroke from 'ol/style/Stroke.js';
	// REMOVE: import { GeoJSON } from 'ol/format'; // No longer needed for primary layer
	import { Style, Circle as CircleStyle } from 'ol/style';
	import { Select } from 'ol/interaction';
	import { click } from 'ol/events/condition';
	import { onDestroy, onMount } from 'svelte'; // Import onMount if needed
	import Overlay from 'ol/Overlay';

	// NEW IMPORTS for Vector Tiles
	import MVT from 'ol/format/MVT.js';
	import VectorTileLayer from 'ol/layer/VectorTile.js';
	import VectorTileSource from 'ol/source/VectorTile.js';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	/** @type {import('./$types').PageData} */
	let { data } = $props(); // data from +page.server.js, may not be used for map layer now

	// State for OpenLayers objects
	let vectorTileLayer = $state(); // Renamed from vectorLayer for clarity
	let olMapInstance = $state();
	let selectInteraction = $state();
	let popupOverlay = $state();

	// Style for all features (will be applied to the VectorTileLayer)
	const trenchStyle = new Style({
		fill: new Fill({
			color: 'rgba(255, 0, 0, 1)'
		}),
		stroke: new Stroke({
			color: 'rgba(255, 0, 0, 1)',
			width: 2
		}),
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: 'rgba(255, 0, 0, 0.5)' }),
			stroke: new Stroke({ color: 'rgba(255, 0, 0, 0.5)', width: 2 })
		})
	});

	// Style for selected features
	const selectedStyle = new Style({
		fill: new Fill({
			color: 'rgba(0, 0, 255, 0.7)' // Blue fill when selected
		}),
		stroke: new Stroke({
			color: 'rgba(0, 0, 255, 1)',
			width: 3
		}),
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: 'rgba(0, 0, 255, 0.7)' }),
			stroke: new Stroke({ color: 'rgba(0, 0, 255, 1)', width: 2 })
		})
	});

	// Create the Vector Tile Layer
	// This runs once when the component script is executed
	try {
		const tileSource = new VectorTileSource({
			format: new MVT(), // Specify MVT format
			// Construct the URL to your MVT endpoint
			url: `${PUBLIC_MAP_TILES_URL}ol_trench_tiles/{z}/{x}/{y}.mvt`, // Standard tile URL pattern
			// Optional: Add attributions, maxZoom, etc.
			// maxZoom: 19, // Example: Set max zoom for which tiles are requested
			tileLoadFunction: (tile, url) => {
				tile.setLoader((extent, resolution, projection) => {
					fetch(url, {
						credentials: 'include' // Crucial for sending cookies
					})
						.then((response) => {
							if (!response.ok) {
								throw new Error(`Failed to load tile: ${response.statusText}`);
							}
							return response.arrayBuffer();
						})
						.then((data) => {
							const format = tile.getFormat(); // Get the MVT format
							const features = format.readFeatures(data, {
								extent: extent,
								featureProjection: projection
							});
							tile.setFeatures(features);
						})
						.catch((error) => {
							console.error('Error loading vector tile:', error);
							tile.setState(3); // 3 corresponds to ol.TileState.ERROR
							// Optionally, you could show a toaster message here as well
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
			style: trenchStyle // Apply the default style
			// declutter: true, // Useful if you have labels to prevent overlap
		});
	} catch (error) {
		toaster.create({
			type: 'error',
			message: 'Error initializing map tiles', // Or a more specific message
			description: error.message || 'Could not set up the tile layer.'
		});
		vectorTileLayer = undefined;
	}

	// Handler for the map ready event
	function handleMapReady(event) {
		olMapInstance = event.detail.map;
		addSelectInteraction(); // Call this after map is ready
	}

	// Function to add the select interaction
	function addSelectInteraction() {
		if (!olMapInstance || !vectorTileLayer) return;

		selectInteraction = new Select({
			condition: click,
			layers: [vectorTileLayer], // Point to the new vectorTileLayer
			style: selectedStyle
		});

		olMapInstance.addInteraction(selectInteraction);

		// Create and add a popup overlay (assuming HTML structure is present)
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
				closer.blur();
				return false;
			};
		}

		selectInteraction.on('select', (event) => {
			const selectedFeatures = event.selected;
			if (selectedFeatures.length > 0) {
				const feature = selectedFeatures[0];
				const properties = feature.getProperties();
				// For MVT, geometry might be a simplified internal representation.
				// The geometry name might not be 'geom' or consistent.
				// It's often safer to just iterate properties or specifically exclude known internal ones.
				let html = '<ul>';
				for (const [key, value] of Object.entries(properties)) {
					// Avoid showing the geometry object itself or internal OpenLayers properties
					if (typeof value !== 'object' && key !== 'layer' && key !== 'source') {
						html += `<li><strong>${key}:</strong> ${value}</li>`;
					}
				}
				html += '</ul>';
				if (content) content.innerHTML = html;
				const coordinate = event.mapBrowserEvent.coordinate;
				popupOverlay.setPosition(coordinate);
			} else {
				popupOverlay.setPosition(undefined);
			}
		});
	}

	onDestroy(() => {
		if (olMapInstance && selectInteraction) {
			olMapInstance.removeInteraction(selectInteraction);
		}
		if (olMapInstance && popupOverlay) {
			olMapInstance.removeOverlay(popupOverlay);
		}
		olMapInstance = undefined;
		selectInteraction = undefined;
		popupOverlay = undefined;
		if (vectorTileLayer && vectorTileLayer.getSource()) {
			vectorTileLayer.getSource().dispose(); // Dispose the source
		}
		vectorTileLayer = undefined; // Clear layer reference
	});

	// The data.error from +page.server.js might still be relevant if that fetch fails
	// for other reasons, or if you decide to keep it for some initial data.
	if (data.error) {
		toaster.create({
			type: 'error',
			message: m.error_loading_map_features(), // This message might need to be more generic
			description: data.error
		});
	}
</script>

<Toaster {toaster}></Toaster>

<div class="map-container relative h-full w-full">
	{#if data.error && !vectorTileLayer}
		<!-- Show initial load error only if tile layer also failed or isn't primary -->
		<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
			<p>Error loading initial map data: {data.error}</p>
		</div>
	{:else if vectorTileLayer}
		<div class="map-wrapper border-2 rounded-lg border-surface-200 h-full w-full">
			<Map
				className="rounded-lg overflow-hidden"
				layers={[vectorTileLayer]}
				on:ready={handleMapReady}
			/>
			<div id="popup" class="ol-popup bg-primary-500 rounded-lg border-2 border-primary-600">
				<!-- svelte-ignore a11y_invalid_attribute -->
				<a href="#" id="popup-closer" class="ol-popup-closer" aria-label="Close popup"></a>
				<div id="popup-content"></div>
			</div>
		</div>
	{:else}
		<!-- This message now means the tile layer couldn't be initialized -->
		<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
			<p>Map tiles could not be loaded. Please check the connection or configuration.</p>
		</div>
	{/if}
</div>

<style>
	.ol-popup {
		position: absolute;
		padding: 8px;
		border: 1px solid #ccc;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		transform: translate(-50%, -100%);
		pointer-events: auto;
		min-width: 180px; /* Example min-width */
	}
	.ol-popup-closer {
		position: absolute;
		top: 4px;
		right: 8px;
		text-decoration: none;
		font-weight: bold;
		cursor: pointer;
	}
</style>
