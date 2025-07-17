<script>
	// Skeleton
	import { Switch, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import { IconCheck, IconX } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { PUBLIC_API_URL } from '$env/static/public';
	import ConduitCombobox from '$lib/components/ConduitCombobox.svelte';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import Map from '$lib/components/Map.svelte';
	import TrenchTable from '$lib/components/TrenchTable.svelte';
	import {
		routingMode,
		routingTolerance,
		selectedConduit,
		selectedFlag,
		selectedProject,
		trenchColor,
		trenchColorSelected
	} from '$lib/stores/store';
	import { onDestroy } from 'svelte';

	// OpenLayers
	import Feature from 'ol/Feature.js';
	import MVT from 'ol/format/MVT.js';
	import WKT from 'ol/format/WKT.js';
	import VectorLayer from 'ol/layer/Vector.js';
	import VectorTileLayer from 'ol/layer/VectorTile.js';
	import 'ol/ol.css';
	import VectorSource from 'ol/source/Vector.js';
	import VectorTileSource from 'ol/source/VectorTile.js';
	import { Circle as CircleStyle, Style } from 'ol/style';
	import Fill from 'ol/style/Fill.js';
	import Stroke from 'ol/style/Stroke.js';
	import Text from 'ol/style/Text.js';

	let { data } = $props();

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let olMapInstance = $state();
	let vectorTileLayer = $state();
	let selectionLayer = $state();
	let routeLayer = $state();
	let highlightLayer = $state();
	let selectionStore = $state({});
	let startTrenchId = $state(null);
	let endTrenchId = $state(null);
	let trenchTableInstance;

	async function handleFlagChange() {
		$selectedConduit = undefined;
	}

	async function handleTrenchClick(trenchUuid, trenchLabel) {
		if (!olMapInstance || !vectorTileLayer) {
			toaster.create({
				type: 'error',
				title: m.error_loading_map_features(),
				description: 'Map not ready'
			});
			return;
		}

		try {
			const formData = new FormData();
			formData.append('trenchLabel', trenchLabel);

			const response = await fetch('?/getTrenchData', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success' && result.data?.trenchData) {
				const trenchData = result.data.trenchData;
				if (
					trenchData.results.features[0].geometry &&
					trenchData.results.features[0].geometry.coordinates
				) {
					const wktFormat = new WKT();
					let geometryWkt = '';

					// Handle different geometry types
					if (trenchData.results.features[0].geometry.type === 'LineString') {
						geometryWkt = `LINESTRING(${trenchData.results.features[0].geometry.coordinates.map((coord) => `${coord[0]} ${coord[1]}`).join(', ')})`;
					} else if (trenchData.results.features[0].geometry.type === 'Point') {
						geometryWkt = `POINT(${trenchData.results.features[0].geometry.coordinates[0]} ${trenchData.results.features[0].geometry.coordinates[1]})`;
					} else if (trenchData.results.features[0].geometry.type === 'Polygon') {
						const rings = trenchData.results.features[0].geometry.coordinates
							.map((ring) => `(${ring.map((coord) => `${coord[0]} ${coord[1]}`).join(', ')})`)
							.join(', ');
						geometryWkt = `POLYGON(${rings})`;
					}

					if (geometryWkt) {
						const view = olMapInstance.getView();
						const geometry = wktFormat.readGeometry(geometryWkt, {
							dataProjection: 'EPSG:25832', // TODO: Get from trench data
							featureProjection: view.getProjection()
						});

						const featureExtent = geometry.getExtent();
						view.fit(featureExtent, {
							duration: 1000,
							padding: [50, 50, 50, 50],
							maxZoom: 20,
							callback: () => {
								if (highlightLayer) {
									const highlightFeature = new Feature(geometry);
									const source = highlightLayer.getSource();
									let blinkCount = 0;
									const blinkInterval = setInterval(() => {
										if (blinkCount % 2 === 0) {
											source.addFeature(highlightFeature);
										} else {
											source.removeFeature(highlightFeature);
										}
										blinkCount++;
										if (blinkCount >= 6) {
											clearInterval(blinkInterval);
											source.removeFeature(highlightFeature);
										}
									}, 300);
								}
							}
						});

						toaster.create({
							type: 'success',
							title: m.trench_located(),
							description: m.trench_located_description({ trenchLabel })
						});
					}
				}
			} else {
				throw new Error('Failed to fetch trench data');
			}
		} catch (error) {
			console.error('Error zooming to trench:', error);
			toaster.create({
				type: 'error',
				title: m.trench_not_visible(),
				description: m.trench_not_visible_description({ trenchLabel })
			});
		}
	}

	$effect(() => {
		const projectId = $selectedProject;
		const flagId = $selectedFlag;
		const currentPath = $page.url.pathname;

		if (projectId && flagId) {
			const targetPath = `/trench/${projectId}/${flagId}`;
			if (currentPath !== targetPath) {
				goto(targetPath, { keepFocus: true, noScroll: true, replaceState: true });
			}
		}
	});

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
							text: (feature.get('id_trench') || '').toString(),
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

		highlightLayer = new VectorLayer({
			source: new VectorSource(),
			style: new Style({
				stroke: new Stroke({
					color: 'rgba(255, 0, 255, 0.7)',
					width: 8
				}),
				image: new CircleStyle({
					radius: 9,
					stroke: new Stroke({
						color: 'rgba(255, 0, 255, 0.7)',
						width: 4
					})
				})
			})
		});
		olMapInstance.addLayer(highlightLayer);

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
					const response = await fetch('/api/routing', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							startTrenchId,
							endTrenchId,
							projectId: $selectedProject,
							tolerance: $routingTolerance
						})
					});
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
						title: m.error_calculating_route(),
						description: error.message // TODO: Translate. This comes from the backend. How?
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
			if (highlightLayer) olMapInstance.removeLayer(highlightLayer);
		}
		olMapInstance = undefined;
		selectionStore = {};
		if (vectorTileLayer && vectorTileLayer.getSource()) {
			vectorTileLayer.getSource().dispose();
		}
		vectorTileLayer = undefined;
		selectionLayer = undefined;
		routeLayer = undefined;
		highlightLayer = undefined;
	});
</script>

<svelte:head>
	<title>{m.conduit_connection()}</title>
</svelte:head>

<Toaster {toaster} />

<div class="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
	<div class="md:col-span-8 border-2 rounded-lg border-surface-200-800 overflow-hidden">
		{#if vectorTileLayer}
			<Map
				className="rounded-lg overflow-hidden h-full w-full"
				layers={selectionLayer && routeLayer && highlightLayer
					? [vectorTileLayer, selectionLayer, routeLayer, highlightLayer]
					: [vectorTileLayer]}
				showLayerVisibilityTree={false}
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
			<ConduitCombobox
				loading={$navigating !== null}
				conduits={data.conduits ?? []}
				conduitsError={data.conduitsError}
				projectId={$selectedProject}
				flagId={$selectedFlag}
			/>
			<TrenchTable
				projectId={$selectedProject}
				conduitId={$selectedConduit}
				onTrenchClick={handleTrenchClick}
				bind:this={trenchTableInstance}
			/>
		</div>
	</div>
</div>
