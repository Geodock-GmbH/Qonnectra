<script>
	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import Map from '$lib/components/Map.svelte';
	import { m } from '$lib/paraglide/messages';

	// OpenLayers
	import 'ol/ol.css';
	import VectorSource from 'ol/source/Vector';
	import VectorLayer from 'ol/layer/Vector';
	import Fill from 'ol/style/Fill.js';
	import Stroke from 'ol/style/Stroke.js';
	import { GeoJSON } from 'ol/format';
	import { Style, Circle as CircleStyle } from 'ol/style'; // Import CircleStyle
	import { Select } from 'ol/interaction'; // Import Select interaction
	import { click } from 'ol/events/condition'; // Import click condition
	import { onDestroy } from 'svelte'; // Import onDestroy
	import Overlay from 'ol/Overlay'; // Import Overlay for popups

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// Extract features
	// const features = data.trenches?.results?.features; // With pagination
	const features = data.trenches?.features; // Without pagination
	const format = new GeoJSON();

	let vectorLayer = $state();
	let olMapInstance = $state(); // Variable to hold the map instance
	let selectInteraction = $state(); // Variable to hold the select interaction
	let popupOverlay = $state(); // Variable to hold the popup overlay

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
			// Style for point features if needed
			radius: 7,
			fill: new Fill({ color: 'rgba(0, 0, 255, 0.7)' }),
			stroke: new Stroke({ color: 'rgba(0, 0, 255, 1)', width: 2 })
		})
	});

	if (features && features.length > 0) {
		try {
			const olFeatures = format.readFeatures(
				{
					type: 'FeatureCollection',
					features: features
				},
				{
					dataProjection: 'EPSG:3857',
					featureProjection: 'EPSG:3857'
				}
			);

			const vectorSource = new VectorSource({
				features: olFeatures
			});

			vectorLayer = new VectorLayer({
				source: vectorSource,
				style: new Style({
					fill: new Fill({
						color: 'rgba(255, 0, 0, 0.5)'
					}),
					stroke: new Stroke({
						color: 'rgba(255, 0, 0, 0.5)',
						width: 2
					}),
					image: new CircleStyle({
						radius: 7,
						fill: new Fill({ color: 'rgba(255, 0, 0, 0.5)' }),
						stroke: new Stroke({ color: 'rgba(255, 0, 0, 0.5)', width: 2 })
					})
				})
			});
		} catch (error) {
			toaster.create({
				type: 'error',
				message: m.error_loading_map_features(),
				description: m.error_loading_map_features_description()
			});
			vectorLayer = undefined;
		}
	} else {
		// No features available
		toaster.create({
			type: 'error',
			message: m.error_loading_map_features(),
			description: m.error_loading_map_features_no_features()
		});
		vectorLayer = undefined;
	}

	// Handler for the map ready event
	function handleMapReady(event) {
		olMapInstance = event.detail.map;
		addSelectInteraction();
	}

	// Function to add the select interaction
	function addSelectInteraction() {
		if (!olMapInstance || !vectorLayer) return; // Ensure map and layer exist

		selectInteraction = new Select({
			condition: click, // Select on click
			layers: [vectorLayer], // Only select features from our vector layer
			style: selectedStyle // Apply the selected style
		});

		olMapInstance.addInteraction(selectInteraction);

		// Create and add a popup overlay
		const popupContainer = document.getElementById('popup');
		const content = document.getElementById('popup-content');
		const closer = document.getElementById('popup-closer');
		popupOverlay = new Overlay({
			element: popupContainer,
			autoPan: true,
			autoPanAnimation: { duration: 250 }
		});
		olMapInstance.addOverlay(popupOverlay);

		// Wire up closer button to hide popup
		closer.onclick = () => {
			popupOverlay.setPosition(undefined);
			closer.blur();
			return false;
		};

		// Listen for the 'select' event
		selectInteraction.on('select', (event) => {
			const selectedFeatures = event.selected;
			if (selectedFeatures.length > 0) {
				// Show popup with feature properties
				const feature = selectedFeatures[0];
				const properties = feature.getProperties();
				delete properties[feature.getGeometryName()]; // Remove geometry attribute
				// Build HTML content
				let html = '<ul>';
				for (const [key, value] of Object.entries(properties)) {
					html += `<li><strong>${key}:</strong> ${value}</li>`;
				}
				html += '</ul>';
				content.innerHTML = html;
				// Position popup at the clicked coordinate
				const coordinate = event.mapBrowserEvent.coordinate;
				popupOverlay.setPosition(coordinate);
			} else {
				// Hide popup when nothing selected
				popupOverlay.setPosition(undefined);
			}
		});
	}

	// Clean up the interaction when the component is destroyed
	onDestroy(() => {
		if (olMapInstance && selectInteraction) {
			olMapInstance.removeInteraction(selectInteraction);
			olMapInstance.removeOverlay(popupOverlay);
		}
		// Clear references
		olMapInstance = undefined;
		selectInteraction = undefined;
		popupOverlay = undefined;
	});

	// Trigger toast immediately on load if there's an error
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
	{#if data.error}
		<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
			<p>Error loading map data: {data.error}</p>
		</div>
	{:else if vectorLayer}
		<div class="map-wrapper h-full w-full relative">
			<!-- Listen for the 'ready' event -->
			<Map
				className="rounded-lg overflow-hidden"
				layers={[vectorLayer]}
				on:ready={handleMapReady}
			/>
			<!-- Popup container for feature info -->
			<div id="popup" class="ol-popup bg-primary-500 rounded-lg border-2 border-primary-600">
				<!-- svelte-ignore a11y_invalid_attribute -->
				<a href="#" id="popup-closer" class="ol-popup-closer" aria-label="Close popup"></a>
				<div id="popup-content"></div>
			</div>
		</div>
	{:else}
		<!-- Message when vectorLayer is undefined but no specific error occurred (e.g., no features found) -->
		<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
			<p>No map features available to display.</p>
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
