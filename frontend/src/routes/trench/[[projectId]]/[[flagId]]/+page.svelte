<script>
	import { onMount, setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import Feature from 'ol/Feature.js';
	import WKT from 'ol/format/WKT.js';
	import VectorLayer from 'ol/layer/Vector.js';

	import { m } from '$lib/paraglide/messages';

	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte.js';
	import ConduitCombobox from '$lib/components/ConduitCombobox.svelte';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import Map from '$lib/components/Map.svelte';
	import {
		routingMode,
		routingTolerance,
		selectedConduit,
		selectedFlag,
		selectedProject,
		trenchColor,
		trenchColorSelected
	} from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import TrenchTable from './TrenchTable.svelte';

	import 'ol/ol.css';

	import VectorSource from 'ol/source/Vector.js';
	import { Circle as CircleStyle, Style } from 'ol/style';
	import Stroke from 'ol/style/Stroke.js';

	let { data } = $props();

	// Initialize managers
	const mapState = new MapState(
		$selectedProject,
		$trenchColor,
		$trenchColorSelected,
		{
			trench: true,
			address: false,
			node: false
		},
		{
			trench: { enabled: true, field: 'id_trench', minResolution: 1.5 }
		}
	);
	const selectionManager = new MapSelectionManager();

	// Set context for child components
	setContext('mapManagers', {
		mapState,
		selectionManager
	});

	// Routing-specific state
	let routeLayer = $state();
	let highlightLayer = $state();
	let startTrenchId = $state(null);
	let endTrenchId = $state(null);
	let trenchTableInstance;

	async function handleFlagChange() {
		$selectedConduit = undefined;
	}

	async function handleTrenchClick(trenchUuid, trenchLabel) {
		if (!mapState.olMap || !mapState.vectorTileLayer) {
			globalToaster.error({
				title: m.title_error_loading_map_features(),
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

			if (result.type === 'success' && result.data) {
				const parsedData = JSON.parse(result.data);
				const geometryType = parsedData[12]; // "LineString"
				const coordinatesRef = parsedData[13]; // Array reference to coordinates

				// The coordinates are stored as separate coordinate pairs in the array
				const coordinates = [];
				if (Array.isArray(coordinatesRef)) {
					for (const coordRef of coordinatesRef) {
						if (typeof coordRef === 'number' && parsedData[coordRef]) {
							// Each coordinate pair is stored as an array reference
							const coordPair = parsedData[coordRef];
							if (Array.isArray(coordPair) && coordPair.length >= 2) {
								const x = parsedData[coordPair[0]];
								const y = parsedData[coordPair[1]];
								coordinates.push([x, y]);
							}
						}
					}
				}

				if (geometryType && coordinates.length > 0) {
					const wktFormat = new WKT();
					let geometryWkt = '';

					// Handle different geometry types
					if (geometryType === 'LineString') {
						geometryWkt = `LINESTRING(${coordinates.map((coord) => `${coord[0]} ${coord[1]}`).join(', ')})`;
					} else if (geometryType === 'Point') {
						geometryWkt = `POINT(${coordinates[0][0]} ${coordinates[0][1]})`;
					} else if (geometryType === 'Polygon') {
						const rings = coordinates
							.map((ring) => `(${ring.map((coord) => `${coord[0]} ${coord[1]}`).join(', ')})`)
							.join(', ');
						geometryWkt = `POLYGON(${rings})`;
					}

					if (geometryWkt) {
						const view = mapState.olMap.getView();
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

						globalToaster.success({
							title: m.title_trench_located(),
							description: m.message_trench_located_description({ trenchLabel })
						});
					}
				}
			} else {
				throw new Error('Failed to fetch trench data');
			}
		} catch (error) {
			console.error('Error zooming to trench:', error);
			globalToaster.error({
				title: m.title_trench_not_visible(),
				description: m.message_trench_not_visible_description({ trenchLabel })
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
			selectionManager.clearSelection();
			if (routeLayer) routeLayer.getSource().clear();
		}
	});

	// Styles for routing layers
	const routeStyle = new Style({
		stroke: new Stroke({
			color: 'rgba(255, 0, 0, 0.7)',
			width: 4
		})
	});

	// Initialize layers
	const layersInitialized = mapState.initializeLayers();

	// Refresh tile sources when they exist
	$effect(() => {
		mapState.refreshTileSources();
	});

	/**
	 * Handler for the map ready event
	 * Initializes all map interactions and layers
	 */
	function handleMapReady(event) {
		const olMapInstance = event.detail.map;

		// Initialize selection layers
		mapState.initializeSelectionLayers(olMapInstance, () => selectionManager.getSelectionStore());

		// Register selection layers with selection manager
		const selectionLayers = mapState.getSelectionLayers();
		selectionLayers.forEach((layer) => selectionManager.registerSelectionLayer(layer));

		// Layer to display the route
		routeLayer = new VectorLayer({
			source: new VectorSource(),
			style: routeStyle
		});
		mapState.olMap.addLayer(routeLayer);

		// Layer to highlight trenches temporarily
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
		mapState.olMap.addLayer(highlightLayer);

		// Register click handler for routing functionality
		mapState.olMap.on('click', handleMapClick);
	}

	/**
	 * Handle map click events for routing and trench selection
	 * @param {Object} event - OpenLayers map click event
	 */
	async function handleMapClick(event) {
		if (!mapState.olMap) return;

		if ($selectedConduit === undefined) {
			globalToaster.error({
				title: m.title_no_conduit_selected(),
				description: m.message_no_conduit_selected_description()
			});
			return;
		}

		const features = mapState.olMap.getFeaturesAtPixel(event.pixel, {
			hitTolerance: 10,
			layerFilter: (layer) => layer === mapState.vectorTileLayer
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
				selectionManager.clearSelection();
				if (routeLayer) routeLayer.getSource().clear();
			}

			if (!startTrenchId) {
				startTrenchId = trenchId;
				selectionManager.selectFeature(featureId, feature);
			} else if (!endTrenchId) {
				if (trenchId === startTrenchId) return; // Can't select same trench
				endTrenchId = trenchId;
				selectionManager.selectFeature(featureId, feature);

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
							featureProjection: mapState.olMap.getView().getProjection()
						});
						if (routeLayer) routeLayer.getSource().addFeature(routeFeature);

						// Update selection to show all traversed trenches
						const newSelection = {};
						for (const uuid of routeData.traversed_trench_uuids) {
							newSelection[uuid] = true;
						}
						selectionManager.selectionStore = newSelection;
						selectionManager.updateSelectionLayers();

						const newSelectionForTrenchTable = routeData.traversed_trench_ids.map((id, index) => ({
							value: routeData.traversed_trench_uuids[index],
							label: id
						}));
						if (trenchTableInstance && $selectedConduit !== undefined) {
							await trenchTableInstance.addRoutedTrenches(newSelectionForTrenchTable);
						}
					} else {
						globalToaster.error({
							title: m.title_error_calculating_route(),
							description: m.message_error_calculating_route_description()
						});
						throw new Error('No route geometry or traversed trench UUIDs found in response.');
					}
				} catch (error) {
					console.error('Routing error:', error);
					globalToaster.error({
						title: m.title_error_calculating_route(),
						description: error.message // TODO: Translate. This comes from the backend. How?
					});
					startTrenchId = null;
					endTrenchId = null;
					selectionManager.clearSelection();
				}
			}
		} else {
			// Handle single-click update logic
			selectionManager.selectFeature(featureId, feature);

			const trenchToAdd = [{ value: featureId, label: trenchId }];
			if (trenchTableInstance) {
				await trenchTableInstance.addRoutedTrenches(trenchToAdd);
			}
		}
	}

	/**
	 * Cleanup on component destroy
	 */
	onMount(() => {
		return () => {
			// Remove custom layers
			if (mapState.olMap) {
				if (routeLayer) mapState.olMap.removeLayer(routeLayer);
				if (highlightLayer) mapState.olMap.removeLayer(highlightLayer);
			}

			// Cleanup managers
			mapState.cleanup();
			selectionManager.cleanup();

			// Reset routing state
			routeLayer = undefined;
			highlightLayer = undefined;
		};
	});
</script>

<svelte:head>
	<title>{m.nav_conduit_connection()}</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
	<div
		class="lg:col-span-8 border-2 rounded-lg border-surface-200-800 overflow-hidden min-h-[400px]"
	>
		{#if layersInitialized}
			<Map
				className="rounded-lg overflow-hidden h-full w-full"
				layers={mapState.getLayers()}
				showLayerVisibilityTree={false}
				showSearchPanel={false}
				on:ready={handleMapReady}
			/>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{/if}
	</div>
	<div class="lg:col-span-4 border-2 rounded-lg border-surface-200-800 overflow-auto">
		<div class="card p-4 flex flex-col gap-3">
			<div class="space-y-4">
				<!-- Routing Mode Toggle -->
				<div class="flex items-center justify-between bg-surface-50-900 rounded-lg">
					<h3 class="text-sm font-medium">{m.form_routing_mode()}</h3>
					<Switch
						name="routing-mode"
						checked={$routingMode}
						onCheckedChange={() => {
							$routingMode = !$routingMode;
						}}
					>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
						<Switch.HiddenInput />
					</Switch>
				</div>

				<!-- Flag Selection -->
				<div class="space-y-2">
					<h3 class="text-sm font-medium">{m.form_flag()}</h3>
					<FlagCombobox
						flags={data.flags}
						flagsError={data.flagsError}
						onchange={handleFlagChange}
					/>
				</div>

				<!-- Conduit Selection -->
				<div class="space-y-2">
					<h3 class="text-sm font-medium">{m.form_conduit()}</h3>
					<ConduitCombobox
						loading={$navigating !== null}
						conduits={data.conduits ?? []}
						conduitsError={data.conduitsError}
						projectId={$selectedProject}
						flagId={$selectedFlag}
					/>
				</div>
			</div>

			<!-- Trench Table -->
			<div class="mt-4">
				<TrenchTable
					projectId={$selectedProject}
					conduitId={$selectedConduit}
					onTrenchClick={handleTrenchClick}
					bind:this={trenchTableInstance}
				/>
			</div>
		</div>
	</div>
</div>
