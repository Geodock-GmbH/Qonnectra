<script>
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	import 'ol/ol.css';

	import { basemapTheme, tileServerAvailable } from '$lib/stores/store';

	/**
	 * @typedef {Object} Props
	 * @property {Object} traceResult - The trace result data with geometry
	 * @property {string|null} [selectedFeatureId] - Currently selected feature ID
	 * @property {(featureId: string|null) => void} [onFeatureSelect] - Selection callback
	 */

	/** @type {Props} */
	let { traceResult, selectedFeatureId = null, onFeatureSelect = () => {} } = $props();

	const TILE_SERVER_URL = env.PUBLIC_TILE_SERVER_URL || '';

	let container = $state(null);
	let map = $state(null);
	let vectorSource = $state(null);
	let markerSource = $state(null);

	const SOURCE_PROJECTION = 'EPSG:25832';
	const TARGET_PROJECTION = 'EPSG:3857';

	let Style, Stroke, Fill, CircleStyle;

	/**
	 * Check if the tile server is available
	 */
	async function checkTileServerHealth() {
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
	 * Apply vector tile basemap style
	 */
	async function applyVectorTileStyle(mapInstance, theme) {
		try {
			const { apply } = await import('ol-mapbox-style');
			const styleUrl = `${TILE_SERVER_URL}/styles/${theme}/style.json`;

			// Remove existing base layers
			const layersToRemove = [];
			mapInstance.getLayers().forEach((layer) => {
				if (layer.get('isBaseLayer')) {
					layersToRemove.push(layer);
				}
			});
			layersToRemove.forEach((layer) => mapInstance.removeLayer(layer));

			await apply(mapInstance, styleUrl);

			// Mark new layers as base layers and reorder
			const baseLayers = [];
			const otherLayers = [];
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
	 * Setup fallback OSM raster tiles
	 */
	async function setupFallbackOSM(mapInstance) {
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
		if (!browser) return;

		const [
			{ default: OlMap },
			{ default: OlView },
			{ default: VectorLayer },
			{ default: VectorSource },
			StyleModule,
			StrokeModule,
			FillModule,
			CircleModule,
			{ register },
			proj4
		] = await Promise.all([
			import('ol/Map'),
			import('ol/View'),
			import('ol/layer/Vector'),
			import('ol/source/Vector'),
			import('ol/style/Style'),
			import('ol/style/Stroke'),
			import('ol/style/Fill'),
			import('ol/style/Circle'),
			import('ol/proj/proj4'),
			import('proj4')
		]);

		Style = StyleModule.default;
		Stroke = StrokeModule.default;
		Fill = FillModule.default;
		CircleStyle = CircleModule.default;

		// Register EPSG:25832
		proj4.default.defs(
			'EPSG:25832',
			'+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
		);
		register(proj4.default);

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
			target: container,
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

		// Click interaction
		map.on('click', (evt) => {
			const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
			if (feature) {
				const featureId = feature.get('featureId');
				onFeatureSelect(featureId);
			} else {
				onFeatureSelect(null);
			}
		});

		// Pointer cursor on hover
		map.on('pointermove', (evt) => {
			const hit = map.hasFeatureAtPixel(evt.pixel);
			map.getTargetElement().style.cursor = hit ? 'pointer' : '';
		});

		// Load features from trace result
		loadFeatures(traceResult);
	});

	onDestroy(() => {
		if (map) {
			map.setTarget(undefined);
			map = null;
		}
	});

	$effect(() => {
		if (!map || !selectedFeatureId) return;

		// Find the feature
		let targetFeature = null;
		vectorSource?.forEachFeature((f) => {
			if (f.get('featureId') === selectedFeatureId) targetFeature = f;
		});
		if (!targetFeature) {
			markerSource?.forEachFeature((f) => {
				if (f.get('featureId') === selectedFeatureId) targetFeature = f;
			});
		}

		if (targetFeature) {
			const geometry = targetFeature.getGeometry();
			const extent = geometry.getExtent();
			map.getView().fit(extent, {
				padding: [100, 100, 100, 100],
				maxZoom: 17,
				duration: 500
			});
		}

		// Refresh styles
		vectorSource?.changed();
		markerSource?.changed();
	});

	function createLineStyle(feature) {
		const featureId = feature.get('featureId') || '';
		const isSelected = featureId === selectedFeatureId;
		const cableId = feature.get('cableId') || '';
		const signalState = feature.get('signalState');
		let color = getCableColor(cableId);
		let lineDash = null;

		if (signalState === 'dark') {
			color = '#9ca3af';
			lineDash = [10, 5];
		} else if (signalState === 'break_point') {
			color = '#ef4444';
		}

		return new Style({
			stroke: new Stroke({
				color: isSelected ? '#3b82f6' : color,
				width: isSelected ? 5 : 3,
				lineDash: lineDash
			})
		});
	}

	function createMarkerStyle(feature) {
		const featureType = feature.get('featureType') || '';
		const featureId = feature.get('featureId') || '';
		const isSelected = featureId === selectedFeatureId;
		const signalState = feature.get('signalState');

		const colors = {
			entry_point: '#6366f1',
			node: '#22c55e',
			address: '#ef4444',
			residential_unit: '#8b5cf6'
		};

		let color = colors[featureType] || '#6b7280';
		const radius = featureType === 'entry_point' ? 10 : 7;

		if (signalState === 'dark') {
			color = '#9ca3af';
		} else if (signalState === 'break_point') {
			color = '#ef4444';
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

	function getCableColor(cableId) {
		if (!cableId) return '#f59e0b';
		let hash = 0;
		for (let i = 0; i < cableId.length; i++) {
			hash = cableId.charCodeAt(i) + ((hash << 5) - hash);
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 70%, 50%)`;
	}

	async function loadFeatures(result) {
		if (!result || !vectorSource || !markerSource) return;

		const { default: GeoJSON } = await import('ol/format/GeoJSON');

		const format = new GeoJSON();
		const allFeatures = [];

		// Extract cable geometry
		const cableInfra = result.cable_infrastructure || {};
		for (const [cableId, infra] of Object.entries(cableInfra)) {
			if (infra.merged_geometry) {
				const geojson = {
					type: 'Feature',
					properties: { featureId: `cable:${cableId}`, cableId, featureType: 'cable' },
					geometry: infra.merged_geometry
				};
				const feature = format.readFeature(geojson, {
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
						const feature = format.readFeature(geojson, {
							dataProjection: SOURCE_PROJECTION,
							featureProjection: TARGET_PROJECTION
						});
						allFeatures.push(feature);
					}
				}
			}
		}

		vectorSource.addFeatures(allFeatures);

		// Extract markers from trace tree
		const markers = [];
		await extractMarkersFromTree(result.trace_tree, markers);
		if (result.trace_trees) {
			for (const tree of result.trace_trees) {
				await extractMarkersFromTree(tree, markers);
			}
		}

		// Add entry point marker
		if (result.entry_point?.geometry) {
			const entryFeature = format.readFeature(
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

		// Fit view to all features
		const allExtent = vectorSource.getExtent();
		const markerExtent = markerSource.getExtent();
		if (allExtent && allExtent[0] !== Infinity) {
			const { extend } = await import('ol/extent');
			const combinedExtent = extend(allExtent, markerExtent);
			map.getView().fit(combinedExtent, { padding: [50, 50, 50, 50], maxZoom: 18 });
		} else if (markerExtent && markerExtent[0] !== Infinity) {
			map.getView().fit(markerExtent, { padding: [50, 50, 50, 50], maxZoom: 18 });
		}
	}

	async function extractMarkersFromTree(node, markers) {
		if (!node) return;

		const { default: GeoJSON } = await import('ol/format/GeoJSON');
		const format = new GeoJSON();

		const signalState = node.signal_state || null;

		// Node marker
		if (node.node?.geometry) {
			const feature = format.readFeature(
				{
					type: 'Feature',
					properties: {
						featureId: `node:${node.node.id}`,
						featureType: 'node',
						name: node.node.name,
						signalState
					},
					geometry: node.node.geometry
				},
				{
					dataProjection: SOURCE_PROJECTION,
					featureProjection: TARGET_PROJECTION
				}
			);
			markers.push(feature);
		}

		// Address marker
		if (node.node?.address?.geometry) {
			const addr = node.node.address;
			const feature = format.readFeature(
				{
					type: 'Feature',
					properties: {
						featureId: `address:${addr.id}`,
						featureType: 'address',
						name: `${addr.street} ${addr.housenumber}`,
						signalState
					},
					geometry: addr.geometry
				},
				{
					dataProjection: SOURCE_PROJECTION,
					featureProjection: TARGET_PROJECTION
				}
			);
			markers.push(feature);
		}

		// Residential unit markers
		if (node.residential_units) {
			for (const ru of node.residential_units) {
				if (ru.geometry) {
					const feature = format.readFeature(
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
						{
							dataProjection: SOURCE_PROJECTION,
							featureProjection: TARGET_PROJECTION
						}
					);
					markers.push(feature);
				}
			}
		}

		// Recurse into children
		if (node.children) {
			for (const child of node.children) {
				await extractMarkersFromTree(child, markers);
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
