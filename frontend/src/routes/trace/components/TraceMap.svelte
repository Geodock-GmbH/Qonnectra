<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';

	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import {
		TRACE_BREAK_COLOR,
		TRACE_DARK_COLOR,
		TRACE_DEFAULT_CABLE_COLOR,
		TRACE_MARKER_COLORS,
		TRACE_SELECTED_COLOR
	} from '$lib/map/styles';

	import 'ol/ol.css';

	import type {
		CableInfrastructure,
		EndpointNode,
		FiberPathNode,
		TraceResult
	} from '../traceUtils';

	import { basemapTheme, tileServerAvailable } from '$lib/stores/store';

	interface Props {
		/** The trace result data with geometry */
		traceResult: TraceResult | null;
		/** Currently selected feature ID */
		selectedFeatureId?: string | null;
		/** Selection callback */
		onFeatureSelect?: (featureId: string | null) => void;
	}

	let { traceResult, selectedFeatureId = null, onFeatureSelect = () => {} }: Props = $props();

	const TILE_SERVER_URL = env.PUBLIC_TILE_SERVER_URL || '';

	let container = $state<HTMLDivElement | null>(null);
	let map = $state<import('ol/Map').default | null>(null);
	let vectorSource = $state<import('ol/source/Vector').default | null>(null);
	let markerSource = $state<import('ol/source/Vector').default | null>(null);

	const SOURCE_PROJECTION = storageProjection(page.data.srid);
	const TARGET_PROJECTION = 'EPSG:3857';

	let Style: typeof import('ol/style/Style').default;
	let Stroke: typeof import('ol/style/Stroke').default;
	let Fill: typeof import('ol/style/Fill').default;
	let CircleStyle: typeof import('ol/style/Circle').default;

	/**
	 * Check if the tile server is available.
	 * @returns Whether the tile server responded successfully
	 */
	async function checkTileServerHealth(): Promise<boolean> {
		if (!TILE_SERVER_URL) return false;
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000);
			const response = await fetch(`${TILE_SERVER_URL}/health`, {
				method: 'HEAD',
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Apply vector tile basemap style, replacing any existing base layers.
	 * @param mapInstance - The OpenLayers map instance
	 * @param theme - The basemap theme name (e.g. 'light', 'dark')
	 */
	async function applyVectorTileStyle(
		mapInstance: import('ol/Map').default,
		theme: string
	): Promise<void> {
		try {
			const { apply } = await import('ol-mapbox-style');
			const styleUrl = `${TILE_SERVER_URL}/styles/${theme}/style.json`;

			const layersToRemove: import('ol/layer/Base').default[] = [];
			mapInstance.getLayers().forEach((layer) => {
				if (layer.get('isBaseLayer')) {
					layersToRemove.push(layer);
				}
			});
			layersToRemove.forEach((layer) => mapInstance.removeLayer(layer));

			await apply(mapInstance, styleUrl);

			const baseLayers: import('ol/layer/Base').default[] = [];
			const otherLayers: import('ol/layer/Base').default[] = [];
			mapInstance.getLayers().forEach((layer) => {
				if (layer.get('isTraceLayer')) {
					otherLayers.push(layer);
				} else if (!layer.get('isBaseLayer')) {
					layer.set('isBaseLayer', true);
					baseLayers.push(layer);
				} else {
					baseLayers.push(layer);
				}
			});

			const layerCollection = mapInstance.getLayers();
			layerCollection.clear();
			baseLayers.forEach((layer) => layerCollection.push(layer));
			otherLayers.forEach((layer) => layerCollection.push(layer));

			$tileServerAvailable = true;
		} catch (error) {
			console.warn('Failed to apply vector tile style, falling back to OSM:', error);
			await setupFallbackOSM(mapInstance);
		}
	}

	/**
	 * Setup fallback OSM raster tiles when the vector tile server is unavailable.
	 * @param mapInstance - The OpenLayers map instance
	 */
	async function setupFallbackOSM(mapInstance: import('ol/Map').default): Promise<void> {
		const [{ default: TileLayer }, { default: OSMSource }] = await Promise.all([
			import('ol/layer/Tile'),
			import('ol/source/OSM')
		]);

		const osmLayer = new TileLayer({
			source: new OSMSource()
		});
		osmLayer.set('isBaseLayer', true);
		mapInstance.getLayers().insertAt(0, osmLayer);
		$tileServerAvailable = false;
	}

	onMount(async () => {
		if (!browser || !container) return;
		const mapTarget = container;

		const [
			{ default: OlMap },
			{ default: OlView },
			{ default: VectorLayer },
			{ default: VectorSource },
			StyleModule,
			StrokeModule,
			FillModule,
			CircleModule
		] = await Promise.all([
			import('ol/Map'),
			import('ol/View'),
			import('ol/layer/Vector'),
			import('ol/source/Vector'),
			import('ol/style/Style'),
			import('ol/style/Stroke'),
			import('ol/style/Fill'),
			import('ol/style/Circle')
		]);

		Style = StyleModule.default;
		Stroke = StrokeModule.default;
		Fill = FillModule.default;
		CircleStyle = CircleModule.default;

		registerStorageProjection(page.data.srid, page.data.proj4Def);

		vectorSource = new VectorSource();
		markerSource = new VectorSource();

		const vectorLayer = new VectorLayer({
			source: vectorSource,
			style: createLineStyle
		});
		vectorLayer.set('isTraceLayer', true);

		const markerLayer = new VectorLayer({
			source: markerSource,
			style: createMarkerStyle
		});
		markerLayer.set('isTraceLayer', true);

		map = new OlMap({
			target: mapTarget,
			layers: [vectorLayer, markerLayer],
			view: new OlView({
				center: [0, 0],
				zoom: 2,
				projection: TARGET_PROJECTION
			})
		});

		// Setup basemap
		const tileServerIsAvailable = await checkTileServerHealth();
		if (tileServerIsAvailable) {
			const theme = $basemapTheme || 'light';
			await applyVectorTileStyle(map, theme);
		} else {
			await setupFallbackOSM(map);
		}

		const olMap = map;
		olMap.on('click', (evt) => {
			const feature = olMap.forEachFeatureAtPixel(evt.pixel, (f) => f);
			if (feature) {
				const featureId = feature.get('featureId');
				onFeatureSelect(featureId);
			} else {
				onFeatureSelect(null);
			}
		});

		olMap.on('pointermove', (evt) => {
			const hit = olMap.hasFeatureAtPixel(evt.pixel);
			olMap.getTargetElement().style.cursor = hit ? 'pointer' : '';
		});

		if (traceResult) loadFeatures(traceResult);
	});

	onDestroy(() => {
		if (map) {
			map.setTarget(undefined);
			map = null;
		}
	});

	$effect(() => {
		if (!map || !selectedFeatureId) return;

		let targetFeature: import('ol').Feature | null = null;
		vectorSource?.forEachFeature((f) => {
			if (f.get('featureId') === selectedFeatureId) targetFeature = f;
		});
		if (!targetFeature) {
			markerSource?.forEachFeature((f) => {
				if (f.get('featureId') === selectedFeatureId) targetFeature = f;
			});
		}

		if (targetFeature) {
			const geometry = (targetFeature as import('ol').Feature).getGeometry();
			const extent = geometry?.getExtent();
			if (!extent) return;
			map.getView().fit(extent, {
				padding: [100, 100, 100, 100],
				maxZoom: 17,
				duration: 500
			});
		}

		vectorSource?.changed();
		markerSource?.changed();
	});

	/**
	 * Style function for cable/trench line features, with selection and signal state styling.
	 * @param feature - The OpenLayers feature to style
	 * @returns The computed line style
	 */
	function createLineStyle(
		feature: import('ol/Feature').FeatureLike
	): import('ol/style/Style').default {
		const featureId = feature.get('featureId') || '';
		const isSelected = featureId === selectedFeatureId;
		const cableId = feature.get('cableId') || '';
		const signalState = feature.get('signalState');
		let color = getCableColor(cableId);
		let lineDash = null;

		if (signalState === 'dark') {
			color = TRACE_DARK_COLOR;
			lineDash = [10, 5];
		} else if (signalState === 'break_point') {
			color = TRACE_BREAK_COLOR;
		}

		return new Style({
			stroke: new Stroke({
				color: isSelected ? TRACE_SELECTED_COLOR : color,
				width: isSelected ? 5 : 3,
				lineDash: lineDash ?? undefined
			})
		});
	}

	/**
	 * Style function for point marker features (nodes, addresses, entry points, residential units).
	 * @param feature - The OpenLayers feature to style
	 * @returns The computed marker style
	 */
	function createMarkerStyle(
		feature: import('ol/Feature').FeatureLike
	): import('ol/style/Style').default {
		const featureType = feature.get('featureType') || '';
		const featureId = feature.get('featureId') || '';
		const isSelected = featureId === selectedFeatureId;
		const signalState = feature.get('signalState');

		let color = TRACE_MARKER_COLORS[featureType] || '#6b7280';
		const radius = featureType === 'entry_point' ? 10 : 7;

		if (signalState === 'dark') {
			color = TRACE_DARK_COLOR;
		} else if (signalState === 'break_point') {
			color = TRACE_BREAK_COLOR;
		}

		return new Style({
			image: new CircleStyle({
				radius: isSelected ? radius + 2 : radius,
				fill: new Fill({ color }),
				stroke: new Stroke({
					color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)',
					width: isSelected ? 3 : 2
				})
			})
		});
	}

	/**
	 * Derive a deterministic color from a cable ID using a hash-based hue.
	 * @param cableId - The cable identifier
	 * @returns A CSS color string (HSL or hex fallback)
	 */
	function getCableColor(cableId: string): string {
		if (!cableId) return TRACE_DEFAULT_CABLE_COLOR;
		let hash = 0;
		for (let i = 0; i < cableId.length; i++) {
			hash = cableId.charCodeAt(i) + ((hash << 5) - hash);
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 70%, 50%)`;
	}

	/**
	 * Parse trace result data into OpenLayers features and add them to the map sources.
	 * @param result - The trace result containing cable_infrastructure, trace_tree, and entry_point
	 */
	async function loadFeatures(result: TraceResult): Promise<void> {
		if (!result || !vectorSource || !markerSource || !map) return;
		const olMap = map;

		const { default: GeoJSON } = await import('ol/format/GeoJSON');

		const format = new GeoJSON();
		const readOne = (
			...args: Parameters<typeof format.readFeature>
		): import('ol/Feature').default => format.readFeature(...args) as import('ol/Feature').default;
		const allFeatures: import('ol/Feature').default[] = [];

		const cableInfra: Record<string, CableInfrastructure> = result.cable_infrastructure || {};
		for (const [cableId, infra] of Object.entries(cableInfra)) {
			if (infra.merged_geometry) {
				const geojson = {
					type: 'Feature',
					properties: { featureId: `cable:${cableId}`, cableId, featureType: 'cable' },
					geometry: infra.merged_geometry
				};
				const feature = readOne(geojson, {
					dataProjection: SOURCE_PROJECTION,
					featureProjection: TARGET_PROJECTION
				});
				allFeatures.push(feature);
			} else if (infra.trenches) {
				for (const trench of infra.trenches) {
					if (trench.geometry) {
						const geojson = {
							type: 'Feature',
							properties: {
								featureId: `trench:${trench.id}`,
								cableId,
								featureType: 'trench'
							},
							geometry: trench.geometry
						};
						const feature = readOne(geojson, {
							dataProjection: SOURCE_PROJECTION,
							featureProjection: TARGET_PROJECTION
						});
						allFeatures.push(feature);
					}
				}
			}
		}

		vectorSource.addFeatures(allFeatures);

		const markers: import('ol/Feature').default[] = [];
		const seenIds = new Set<string>();
		await extractMarkersFromTree(result.trace_tree, markers, seenIds);
		if (result.trace_trees) {
			for (const tree of result.trace_trees) {
				await extractMarkersFromTree(tree, markers, seenIds);
			}
		}

		if (result.entry_point?.geometry) {
			const entryFeature = readOne(
				{
					type: 'Feature',
					properties: {
						featureId: `${result.entry_point.type}:${result.entry_point.id}`,
						featureType: 'entry_point',
						name: result.entry_point.name
					},
					geometry: result.entry_point.geometry
				},
				{
					dataProjection: SOURCE_PROJECTION,
					featureProjection: TARGET_PROJECTION
				}
			);
			markers.push(entryFeature);
		}

		markerSource.addFeatures(markers);

		const allExtent = vectorSource.getExtent();
		const markerExtent = markerSource.getExtent();
		if (allExtent && allExtent[0] !== Infinity) {
			const { extend } = await import('ol/extent');
			const combinedExtent = extend(allExtent, markerExtent);
			olMap.getView().fit(combinedExtent, { padding: [50, 50, 50, 50], maxZoom: 18 });
		} else if (markerExtent && markerExtent[0] !== Infinity) {
			olMap.getView().fit(markerExtent, { padding: [50, 50, 50, 50], maxZoom: 18 });
		}
	}

	/**
	 * Recursively walk the trace tree and create point features for nodes, addresses, residential units, and cable endpoints.
	 * @param node - A trace tree node containing node/address/residential_unit data and children
	 * @param markers - Accumulator array for created marker features
	 * @param seenIds - Set of already-added feature IDs for deduplication
	 */
	async function extractMarkersFromTree(
		node: FiberPathNode | null | undefined,
		markers: import('ol/Feature').default[],
		seenIds: Set<string>
	): Promise<void> {
		if (!node) return;

		const { default: GeoJSON } = await import('ol/format/GeoJSON');
		const format = new GeoJSON();
		const readOne = (
			...args: Parameters<typeof format.readFeature>
		): import('ol/Feature').default => format.readFeature(...args) as import('ol/Feature').default;

		const signalState = node.signal_state || null;

		/**
		 * Creates and adds a node marker feature if not already seen.
		 * @param nodeData - Node data with id, name, geometry, and optional address
		 * @param signal - Signal state for styling
		 */
		function addNodeMarker(nodeData: EndpointNode | undefined, signal: string | null) {
			if (!nodeData?.geometry || !nodeData.id || seenIds.has(nodeData.id)) return;
			seenIds.add(nodeData.id);
			markers.push(
				readOne(
					{
						type: 'Feature',
						properties: {
							featureId: `node:${nodeData.id}`,
							featureType: 'node',
							name: nodeData.name,
							signalState: signal
						},
						geometry: nodeData.geometry
					},
					{ dataProjection: SOURCE_PROJECTION, featureProjection: TARGET_PROJECTION }
				)
			);
			if (nodeData.address?.geometry && nodeData.address.id && !seenIds.has(nodeData.address.id)) {
				seenIds.add(nodeData.address.id);
				const addr = nodeData.address;
				markers.push(
					readOne(
						{
							type: 'Feature',
							properties: {
								featureId: `address:${addr.id}`,
								featureType: 'address',
								name: `${addr.street} ${addr.housenumber}`,
								signalState: signal
							},
							geometry: addr.geometry
						},
						{ dataProjection: SOURCE_PROJECTION, featureProjection: TARGET_PROJECTION }
					)
				);
			}
		}

		addNodeMarker(node.node, signalState);

		if (node.cable_endpoints) {
			addNodeMarker(node.cable_endpoints.start_node, signalState);
			addNodeMarker(node.cable_endpoints.end_node, signalState);
		}

		if (node.residential_units) {
			for (const ru of node.residential_units) {
				if (ru.geometry && ru.id && !seenIds.has(ru.id)) {
					seenIds.add(ru.id);
					markers.push(
						readOne(
							{
								type: 'Feature',
								properties: {
									featureId: `residential_unit:${ru.id}`,
									featureType: 'residential_unit',
									name: ru.id_residential_unit,
									signalState
								},
								geometry: ru.geometry
							},
							{ dataProjection: SOURCE_PROJECTION, featureProjection: TARGET_PROJECTION }
						)
					);
				}
			}
		}

		if (node.children) {
			for (const child of node.children) {
				await extractMarkersFromTree(child, markers, seenIds);
			}
		}
	}
</script>

<div class="map-container rounded-xl border border-surface-200-800 overflow-hidden">
	<div bind:this={container} class="map"></div>
</div>

<style>
	.map-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.map {
		width: 100%;
		height: 100%;
	}
</style>
