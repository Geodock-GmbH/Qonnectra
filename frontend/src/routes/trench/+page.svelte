<script>
	// Skeleton
	import { Switch, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconCheck, IconX } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import {
		selectedProject,
		selectedFlag,
		selectedConduit,
		routingMode,
		routingTolerance,
		trenchColor,
		trenchColorSelected
	} from '$lib/stores/store';
	import { PUBLIC_API_URL } from '$env/static/public';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import ConduitCombobox from '$lib/components/ConduitCombobox.svelte';
	import TrenchTable from '$lib/components/TrenchTable.svelte';
	import Map from '$lib/components/Map.svelte';
	import { onDestroy } from 'svelte';

	// OpenLayers
	import 'ol/ol.css';
	import Fill from 'ol/style/Fill.js';
	import Stroke from 'ol/style/Stroke.js';
	import Text from 'ol/style/Text.js';
	import { Style, Circle as CircleStyle } from 'ol/style';
	import MVT from 'ol/format/MVT.js';
	import VectorTileLayer from 'ol/layer/VectorTile.js';
	import VectorTileSource from 'ol/source/VectorTile.js';
	import VectorLayer from 'ol/layer/Vector.js';
	import VectorSource from 'ol/source/Vector.js';
	import WKT from 'ol/format/WKT.js';

	let { data } = $props();

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let olMapInstance = $state();
	let vectorTileLayer = $state();
	let selectionLayer = $state();
	let routeLayer = $state();
	let selectionStore = $state({});
	let startTrenchId = $state(null);
	let endTrenchId = $state(null);
	let trenchTableInstance;

	function handleFlagChange() {
		$selectedConduit = undefined;
	}

	$effect(() => {
		if (!$routingMode || $routingMode) {
			startTrenchId = null;
			endTrenchId = null;
			selectionStore = {};
			if (selectionLayer) selectionLayer.changed();
			if (routeLayer) routeLayer.getSource().clear();
		}
	});

	$effect(() => {
		if (vectorTileLayer) {
			vectorTileLayer.getSource().refresh();
		}
	});

	const trenchStyle = (feature, resolution) =>
		new Style({
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
			}),
			text:
				resolution < 1.5
					? new Text({
							text: feature.get('id_trench').toString(),
							font: '12px Calibri,sans-serif',
							fill: new Fill({
								color: '#000'
							}),
							stroke: new Stroke({
								color: '#fff',
								width: 3
							}),
							offsetX: 15,
							offsetY: 15,
							textAlign: 'center'
						})
					: undefined
		});

	// Style for selected features
	const selectedStyle = new Style({
		stroke: new Stroke({
			color: $trenchColorSelected,
			width: 5
		}),
		fill: new Fill({
			color: 'rgba(255, 255, 255, 0.5)'
		}),
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: $trenchColorSelected }),
			stroke: new Stroke({ color: $trenchColorSelected, width: 2 })
		})
	});

	const routeStyle = new Style({
		stroke: new Stroke({
			color: 'rgba(255, 0, 0, 0.7)',
			width: 4
		})
	});

	// Create the Vector Tile Layer and Source
	let tileSource;
	try {
		tileSource = new VectorTileSource({
			format: new MVT({
				idProperty: 'uuid' // Use 'uuid' for feature identification
			}),
			tileUrlFunction: (tileCoord) => {
				const [z, x, y] = tileCoord;
				const projectId = parseInt($selectedProject, 10);
				if (isNaN(projectId)) {
					return undefined;
				}
				return `${PUBLIC_API_URL}ol_trench_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
			},
			tileLoadFunction: (tile, url) => {
				if (!url) {
					tile.setState(4); // EMPTY
					return;
				}
				tile.setLoader((extent, resolution, projection) => {
					fetch(url, { credentials: 'include' })
						.then((response) => {
							if (!response.ok) throw new Error(`Failed to load tile: ${response.statusText}`);
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
							tile.setState(3); // ERROR
							toaster.create({
								type: 'error',
								title: m.error_loading_map_features(),
								description: m.error_loading_map_features_description()
							});
						});
				});
			}
		});

		vectorTileLayer = new VectorTileLayer({
			source: tileSource,
			style: trenchStyle,
			renderMode: 'vector',
			declutter: true
		});
	} catch (error) {
		toaster.create({
			type: 'error',
			title: m.error_creating_vector_tile_layer(),
			description: m.error_creating_vector_tile_layer_description()
		});
		vectorTileLayer = undefined;
		tileSource = undefined;
	}

	function handleMapReady(event) {
		olMapInstance = event.detail.map;
		initializeMapInteractions();
	}

	function initializeMapInteractions() {
		if (!olMapInstance || !vectorTileLayer || !tileSource) return;

		// Selection layer for start/end trenches
		selectionLayer = new VectorTileLayer({
			renderMode: 'vector',
			source: tileSource,
			style: function (feature) {
				return selectionStore[feature.getId()] ? selectedStyle : undefined;
			}
		});
		olMapInstance.addLayer(selectionLayer);

		// Layer to display the route
		routeLayer = new VectorLayer({
			source: new VectorSource(),
			style: routeStyle
		});
		olMapInstance.addLayer(routeLayer);

		olMapInstance.on('click', handleMapClick);
	}

	async function handleMapClick(event) {
		if (!olMapInstance) return;

		if ($selectedConduit === undefined) {
			toaster.create({
				type: 'error',
				title: m.no_conduit_selected(),
				description: m.no_conduit_selected_description()
			});
			return;
		}

		const features = olMapInstance.getFeaturesAtPixel(event.pixel, {
			hitTolerance: 10,
			layerFilter: (layer) => layer === vectorTileLayer
		});

		if (features.length === 0) return;

		const feature = features[0];
		const trenchId = feature.get('id_trench');
		const featureId = feature.getId(); // This is the UUID of the trench feature

		if (!trenchId || !featureId) return;

		if ($routingMode) {
			// Handle routing logic
			if (startTrenchId && endTrenchId) {
				startTrenchId = null;
				endTrenchId = null;
				selectionStore = {};
				if (routeLayer) routeLayer.getSource().clear();
			}

			if (!startTrenchId) {
				startTrenchId = trenchId;
				selectionStore[featureId] = feature;
			} else if (!endTrenchId) {
				if (trenchId === startTrenchId) return; // Can't select same trench
				endTrenchId = trenchId;
				selectionStore[featureId] = feature;

				try {
					const url = `${PUBLIC_API_URL}routing/${startTrenchId}/${endTrenchId}/${$selectedProject}/${$routingTolerance}/`;
					const response = await fetch(url, { credentials: 'include' });
					if (!response.ok) {
						const errorData = await response.json();
						throw new Error(
							errorData.error ||
								errorData.detail ||
								`Routing failed with status: ${response.status}`
						);
					}
					const routeData = await response.json();

					if (routeData.path_geometry_wkt && routeData.traversed_trench_uuids) {
						const wktFormat = new WKT();
						const routeFeature = wktFormat.readFeature(routeData.path_geometry_wkt, {
							dataProjection: 'EPSG:25832', // TODO: Get from trench data
							featureProjection: olMapInstance.getView().getProjection()
						});
						if (routeLayer) routeLayer.getSource().addFeature(routeFeature);

						const newSelection = {};
						for (const uuid of routeData.traversed_trench_uuids) {
							newSelection[uuid] = true;
						}
						selectionStore = newSelection;

						const newSelectionForTrenchTable = routeData.traversed_trench_ids.map((id, index) => ({
							value: routeData.traversed_trench_uuids[index],
							label: id
						}));
						if (trenchTableInstance && $selectedConduit !== undefined) {
							await trenchTableInstance.addRoutedTrenches(newSelectionForTrenchTable);
						}

						toaster.create({
							type: 'success',
							title: m.route_found(),
							description: m.route_found_description()
						});
					} else {
						toaster.create({
							type: 'error',
							title: m.error_calculating_route(),
							description: m.error_calculating_route_description()
						});
						throw new Error('No route geometry or traversed trench UUIDs found in response.');
					}
				} catch (error) {
					console.error('Routing error:', error);
					toaster.create({
						type: 'error',
						message: 'Could not calculate route',
						description: error.message
					});
					startTrenchId = null;
					endTrenchId = null;
					selectionStore = {};
				}
			}
			if (selectionLayer) selectionLayer.changed();
		} else {
			// Handle single-click update logic
			selectionStore = { [featureId]: feature };
			if (selectionLayer) selectionLayer.changed();

			const trenchToAdd = [{ value: featureId, label: trenchId }];
			if (trenchTableInstance) {
				await trenchTableInstance.addRoutedTrenches(trenchToAdd);
			}
		}
	}

	onDestroy(() => {
		if (olMapInstance) {
			olMapInstance.un('click', handleMapClick);
			if (selectionLayer) olMapInstance.removeLayer(selectionLayer);
			if (routeLayer) olMapInstance.removeLayer(routeLayer);
		}
		olMapInstance = undefined;
		selectionStore = {};
		if (vectorTileLayer && vectorTileLayer.getSource()) {
			vectorTileLayer.getSource().dispose();
		}
		vectorTileLayer = undefined;
		selectionLayer = undefined;
		routeLayer = undefined;
	});
</script>

<Toaster {toaster} />

<div class="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
	<div class="md:col-span-8 border-2 rounded-lg border-surface-200-800 overflow-hidden">
		{#if vectorTileLayer}
			<Map
				className="rounded-lg overflow-hidden h-full w-full"
				layers={selectionLayer && routeLayer
					? [vectorTileLayer, selectionLayer, routeLayer]
					: [vectorTileLayer]}
				on:ready={handleMapReady}
			/>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>Map tiles could not be loaded. Please check the connection or configuration.</p>
			</div>
		{/if}
	</div>
	<div class="md:col-span-4 border-2 rounded-lg border-surface-200-800 overflow-auto">
		<div class="card p-4 flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<h3>{m.settings_map_routing_mode()}</h3>
				<Switch
					name="routing-mode"
					checked={$routingMode}
					onCheckedChange={() => {
						$routingMode = !$routingMode;
					}}
				>
					{#snippet inactiveChild()}
						<IconX size="18" />
					{/snippet}
					{#snippet activeChild()}
						<IconCheck size="18" />
					{/snippet}
				</Switch>
			</div>
			<div class="flex items-center justify-between">
				<h3>{m.flag()}</h3>
			</div>
			<FlagCombobox flags={data.flags} flagsError={data.flagsError} onchange={handleFlagChange} />
			<h3>{m.conduit()}</h3>
			<ConduitCombobox projectId={$selectedProject} flagId={$selectedFlag} />
			<TrenchTable conduitId={$selectedConduit} bind:this={trenchTableInstance} />
		</div>
	</div>
</div>
