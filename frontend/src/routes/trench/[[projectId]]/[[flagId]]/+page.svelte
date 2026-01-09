<script>
	import { onMount, setContext, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import WKT from 'ol/format/WKT.js';
	import VectorLayer from 'ol/layer/Vector.js';

	import { m } from '$lib/paraglide/messages';

	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte.js';
	import ConduitCombobox from '$lib/components/ConduitCombobox.svelte';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import Map from '$lib/components/Map.svelte';
	import { zoomToFeature } from '$lib/map/searchUtils.js';
	import {
		addressStyle,
		areaTypeStyles,
		labelVisibilityConfig,
		nodeTypeStyles,
		routingMode,
		routingTolerance,
		selectedConduit,
		selectedFlag,
		selectedProject,
		showLinkedTrenches,
		trenchColor,
		trenchColorSelected,
		trenchConstructionTypeStyles,
		trenchStyleMode,
		trenchSurfaceStyles
	} from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { createZoomToLayerExtentHandler } from '$lib/utils/zoomToLayerExtent';

	import TrenchTable from './TrenchTable.svelte';

	import 'ol/ol.css';

	import VectorTileLayer from 'ol/layer/VectorTile.js';
	import VectorSource from 'ol/source/Vector.js';
	import { Circle as CircleStyle, Style } from 'ol/style';
	import Stroke from 'ol/style/Stroke.js';

	import { createLinkedTrenchStyle } from '$lib/map/styles.js';

	let { data } = $props();

	const mapState = new MapState($selectedProject, get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});
	const selectionManager = new MapSelectionManager();

	setContext('mapManagers', {
		mapState,
		selectionManager
	});

	let routeLayer = $state();
	let highlightLayer = $state();
	let linkedTrenchesLayer = $state();
	let linkedTrenchUuids = $state(new Set());
	let startTrenchId = $state(null);
	let endTrenchId = $state(null);
	let trenchTableInstance;

	/**
	 * Handles flag change by clearing the selected conduit
	 */
	async function handleFlagChange() {
		$selectedConduit = undefined;
	}

	/**
	 * Handles changes to the trench connections list
	 * Updates the linked trenches UUIDs for highlighting
	 * @param {Array} trenches - Array of trench connection objects
	 */
	function handleTrenchesChange(trenches) {
		linkedTrenchUuids = new Set(trenches.map((t) => t.trench));
		if (linkedTrenchesLayer) {
			linkedTrenchesLayer.changed();
		}
	}

	/**
	 * Handles trench click event, fetches trench geometry and zooms to it on the map
	 * @param {string} trenchUuid - UUID of the trench
	 * @param {string} trenchLabel - Label/ID of the trench
	 */
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
				const geometryType = parsedData[12];
				const coordinatesRef = parsedData[13];

				const coordinates = [];
				if (Array.isArray(coordinatesRef)) {
					for (const coordRef of coordinatesRef) {
						if (typeof coordRef === 'number' && parsedData[coordRef]) {
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
							dataProjection: 'EPSG:25832',
							featureProjection: view.getProjection()
						});

						await zoomToFeature(mapState.olMap, geometry, highlightLayer, { maxZoom: 20 });

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

	// Navigate to trench page when project or flag changes
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

	// Clear routing state when routing mode changes
	$effect(() => {
		if (!$routingMode || $routingMode) {
			startTrenchId = null;
			endTrenchId = null;
			selectionManager.clearSelection();
			if (routeLayer) routeLayer.getSource().clear();
		}
	});

	// Reinitialize map layers when project changes
	$effect(() => {
		const currentProject = $selectedProject;
		// Only reinitialize if project actually changed and map is ready
		untrack(() => {
			if (mapState.olMap && currentProject !== mapState.selectedProject) {
				mapState.reinitializeForProject(currentProject);
				selectionManager.clearSelection();
			}
		});
	});

	const routeStyle = new Style({
		stroke: new Stroke({
			color: 'rgba(255, 0, 0, 0.7)',
			width: 4
		})
	});

	const layersInitialized = mapState.initializeLayers();

	$effect(() => {
		mapState.refreshTileSources();
	});

	/**
	 * Handler for the map ready event
	 * Initializes all map interactions and layers
	 */
	/**
	 * Handler for the map ready event
	 * Initializes all map interactions and layers
	 * @param {CustomEvent} event - Map ready event containing the OpenLayers map instance
	 */
	function handleMapReady(event) {
		const olMapInstance = event.detail.map;

		mapState.initializeSelectionLayers(olMapInstance, () => selectionManager.getSelectionStore());

		const selectionLayers = mapState.getSelectionLayers();
		selectionLayers.forEach((layer) => selectionManager.registerSelectionLayer(layer));

		// Create linked trenches highlight layer
		const linkedTrenchStyle = createLinkedTrenchStyle();
		linkedTrenchesLayer = new VectorTileLayer({
			renderMode: 'vector',
			source: mapState.vectorTileLayer.getSource(),
			style: function (feature) {
				if (feature.getId() && linkedTrenchUuids.has(feature.getId())) {
					return linkedTrenchStyle;
				}
				return undefined;
			},
			visible: $showLinkedTrenches
		});
		mapState.olMap.addLayer(linkedTrenchesLayer);

		routeLayer = new VectorLayer({
			source: new VectorSource(),
			style: routeStyle
		});
		mapState.olMap.addLayer(routeLayer);

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

		mapState.olMap.on('click', handleMapClick);
	}

	// Create zoom to layer extent handler using utility function
	const handleZoomToExtent = createZoomToLayerExtentHandler(
		() => mapState.olMap,
		() => $selectedProject
	);

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
		const featureId = feature.getId();

		if (!trenchId || !featureId) return;

		if ($routingMode) {
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
				if (trenchId === startTrenchId) return;
				endTrenchId = trenchId;
				selectionManager.selectFeature(featureId, feature);

				try {
					const formData = new FormData();
					formData.append('startTrenchId', startTrenchId);
					formData.append('endTrenchId', endTrenchId);
					formData.append('projectId', $selectedProject);
					formData.append('tolerance', $routingTolerance);

					const response = await fetch('?/calculateRoute', {
						method: 'POST',
						body: formData
					});

					const result = deserialize(await response.text());

					if (result.type === 'failure' || result.type === 'error') {
						throw new Error(result.data?.error || result.data?.detail || 'Routing failed');
					}

					const routeData = result.data?.routeData;

					if (routeData.path_geometry_wkt && routeData.traversed_trench_uuids) {
						const wktFormat = new WKT();
						const routeFeature = wktFormat.readFeature(routeData.path_geometry_wkt, {
							dataProjection: 'EPSG:25832',
							featureProjection: mapState.olMap.getView().getProjection()
						});
						if (routeLayer) routeLayer.getSource().addFeature(routeFeature);

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
						description: error.message
					});
					startTrenchId = null;
					endTrenchId = null;
					selectionManager.clearSelection();
				}
			}
		} else {
			selectionManager.selectFeature(featureId, feature);

			const trenchToAdd = [{ value: featureId, label: trenchId }];
			if (trenchTableInstance) {
				await trenchTableInstance.addRoutedTrenches(trenchToAdd);
			}
		}
	}

	$effect(() => {
		const styles = $nodeTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateNodeLayerStyle(styles);
		}
	});

	$effect(() => {
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		mapState.updateTrenchLayerStyle(mode, surfaceStyles, constructionTypeStyles, color);
	});

	$effect(() => {
		const color = $addressStyle.color;
		const size = $addressStyle.size;
		mapState.updateAddressLayerStyle(color, size);
	});

	// Update area layer style when areaTypeStyles changes
	$effect(() => {
		const styles = $areaTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateAreaLayerStyle(styles);
		}
	});

	$effect(() => {
		const config = $labelVisibilityConfig;
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		const nodeStyles = $nodeTypeStyles;
		const areaStyles = $areaTypeStyles;

		if (config.trench !== undefined) {
			mapState.updateLabelVisibility('trench', config.trench, {
				mode,
				surfaceStyles,
				constructionTypeStyles,
				color
			});
		}
		if (config.address !== undefined) {
			mapState.updateLabelVisibility('address', config.address, {});
		}
		if (config.node !== undefined) {
			mapState.updateLabelVisibility('node', config.node, { nodeTypeStyles: nodeStyles });
		}
		if (config.area !== undefined) {
			mapState.updateLabelVisibility('area', config.area, { areaTypeStyles: areaStyles });
		}
	});

	// Toggle linked trenches layer visibility
	$effect(() => {
		if (linkedTrenchesLayer) {
			linkedTrenchesLayer.setVisible($showLinkedTrenches);
		}
	});

	/**
	 * Cleanup on component destroy
	 */
	onMount(() => {
		return () => {
			if (mapState.olMap) {
				if (routeLayer) mapState.olMap.removeLayer(routeLayer);
				if (highlightLayer) mapState.olMap.removeLayer(highlightLayer);
				if (linkedTrenchesLayer) mapState.olMap.removeLayer(linkedTrenchesLayer);
			}

			mapState.cleanup();
			selectionManager.cleanup();

			routeLayer = undefined;
			highlightLayer = undefined;
			linkedTrenchesLayer = undefined;
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
				showLayerVisibilityTree={true}
				showSearchPanel={true}
				on:ready={handleMapReady}
				nodeTypes={data.nodeTypes ?? []}
				surfaces={data.surfaces ?? []}
				constructionTypes={data.constructionTypes ?? []}
				areaTypes={data.areaTypes ?? []}
				searchPanelProps={{
					trenchColorSelected: $trenchColorSelected,
					alias: data.alias
				}}
				onZoomToExtent={handleZoomToExtent}
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

				<!-- Show Linked Trenches Toggle -->
				<div class="flex items-center justify-between bg-surface-50-900 rounded-lg">
					<h3 class="text-sm font-medium">{m.form_show_linked_trenches()}</h3>
					<Switch
						name="show-linked-trenches"
						checked={$showLinkedTrenches}
						onCheckedChange={() => {
							$showLinkedTrenches = !$showLinkedTrenches;
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
					onTrenchesChange={handleTrenchesChange}
					bind:this={trenchTableInstance}
				/>
			</div>
		</div>
	</div>
</div>
