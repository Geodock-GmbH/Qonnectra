<script>
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	import 'ol/ol.css';

	import { basemapTheme, tileServerAvailable } from '$lib/stores/store';

	/**
	 * @typedef {Object} Props
	 * @property {Record<string, any>|null} traceResult - The trace result data with geometry
	 * @property {string|null} [selectedFeatureId] - Currently selected feature ID
	 * @property {(featureId: string|null) => void} [onFeatureSelect] - Selection callback
	 */

	/** @type {Props} */
	let { traceResult, selectedFeatureId = null, onFeatureSelect = () => {} } = $props();

	const TILE_SERVER_URL = env.PUBLIC_TILE_SERVER_URL || '';

	/** @type {any} */
	let container = $state(null);
	/** @type {any} */
	let map = $state(null);
	/** @type {any} */
	let vectorSource = $state(null);
	/** @type {any} */
	let markerSource = $state(null);

	const SOURCE_PROJECTION = 'EPSG:25832';
	const TARGET_PROJECTION = 'EPSG:3857';

	/** @type {any} */
	let Style;
	/** @type {any} */
	let Stroke;
	/** @type {any} */
	let Fill;
	/** @type {any} */
	let CircleStyle;

	/**
	 * Check if the tile server is available.
	 * @returns {Promise<boolean>} Whether the tile server responded successfully
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
	 * Apply vector tile basemap style, replacing any existing base layers.
	 * @param {import('ol/Map').default} mapInstance - The OpenLayers map instance
	 * @param {string} theme - The basemap theme name (e.g. 'light', 'dark')
	 * @returns {Promise<void>}
	 */
	async function applyVectorTileStyle(mapInstance, theme) {
		try {
			const { apply } = await import('ol-mapbox-style');
			const styleUrl = `${TILE_SERVER_URL}/styles/${theme}/style.json`;

			/** @type {any[]} */
			const layersToRemove = [];
			mapInstance.getLayers().forEach((/** @type {any} */ layer) => {
				if (layer.get('isBaseLayer')) {
					layersToRemove.push(layer);
				}
			});
			layersToRemove.forEach((/** @type {any} */ layer) => mapInstance.removeLayer(layer));

			await apply(mapInstance, styleUrl);

			/** @type {any[]} */
			const baseLayers = [];
			/** @type {any[]} */
			const otherLayers = [];
			mapInstance.getLayers().forEach((/** @type {any} */ layer) => {
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
			baseLayers.forEach((/** @type {any} */ layer) => layerCollection.push(layer));
			otherLayers.forEach((/** @type {any} */ layer) => layerCollection.push(layer));

			$tileServerAvailable = true;
		} catch (error) {
			console.warn('Failed to apply vector tile style, falling back to OSM:', error);
			await setupFallbackOSM(mapInstance);
		}
	}

	/**
	 * Setup fallback OSM raster tiles when the vector tile server is unavailable.
	 * @param {import('ol/Map').default} mapInstance - The OpenLayers map instance
	 * @returns {Promise<void>}
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

		proj4.default.defs(
			'EPSG:25832',
			'+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
		);
		register(proj4.default);

		vectorSource = new VectorSource();
		markerSource = new VectorSource();

		const vectorLayer = new VectorLayer({
			source: vectorSource,
			style: /** @type {any} */ (createLineStyle)
		});
		vectorLayer.set('isTraceLayer', true);

		const markerLayer = new VectorLayer({
			source: markerSource,
			style: /** @type {any} */ (createMarkerStyle)
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

		map.on('click', (/** @type {any} */ evt) => {
			const feature = map.forEachFeatureAtPixel(evt.pixel, (/** @type {any} */ f) => f);
			if (feature) {
				const featureId = feature.get('featureId');
				onFeatureSelect(featureId);
			} else {
				onFeatureSelect(null);
			}
		});

		map.on('pointermove', (/** @type {any} */ evt) => {
			const hit = map.hasFeatureAtPixel(evt.pixel);
			map.getTargetElement().style.cursor = hit ? 'pointer' : '';
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

		/** @type {any} */
		let targetFeature = null;
		vectorSource?.forEachFeature((/** @type {any} */ f) => {
			if (f.get('featureId') === selectedFeatureId) targetFeature = f;
		});
		if (!targetFeature) {
			markerSource?.forEachFeature((/** @type {any} */ f) => {
				if (f.get('featureId') === selectedFeatureId) targetFeature = f;
			});
		}

		if (targetFeature) {
			const geometry = /** @type {any} */ (targetFeature.getGeometry());
			const extent = geometry.getExtent();
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
	 * @param {any} feature - The OpenLayers feature to style
	 * @returns {any} The computed line style
	 */
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

	/**
	 * Style function for point marker features (nodes, addresses, entry points, residential units).
	 * @param {import('ol/Feature').default} feature - The OpenLayers feature to style
	 * @returns {import('ol/style/Style').default} The computed marker style
	 */
	function createMarkerStyle(feature) {
		const featureType = feature.get('featureType') || '';
		const featureId = feature.get('featureId') || '';
		const isSelected = featureId === selectedFeatureId;
		const signalState = feature.get('signalState');

		/** @type {Record<string, string>} */
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

	/**
	 * Derive a deterministic color from a cable ID using a hash-based hue.
	 * @param {string} cableId - The cable identifier
	 * @returns {string} A CSS color string (HSL or hex fallback)
	 */
	function getCableColor(cableId) {
		if (!cableId) return '#f59e0b';
		let hash = 0;
		for (let i = 0; i < cableId.length; i++) {
			hash = cableId.charCodeAt(i) + ((hash << 5) - hash);
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 70%, 50%)`;
	}

	/**
	 * Parse trace result data into OpenLayers features and add them to the map sources.
	 * @param {Record<string, any>} result - The trace result containing cable_infrastructure, trace_tree, and entry_point
	 * @returns {Promise<void>}
	 */
	async function loadFeatures(result) {
		if (!result || !vectorSource || !markerSource) return;

		const { default: GeoJSON } = await import('ol/format/GeoJSON');

		const format = new GeoJSON();
		const allFeatures = [];

		/** @type {Record<string, any>} */
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

		/** @type {any[]} */
		const markers = [];
		await extractMarkersFromTree(result.trace_tree, markers);
		if (result.trace_trees) {
			for (const tree of result.trace_trees) {
				await extractMarkersFromTree(tree, markers);
			}
		}

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

	/**
	 * Recursively walk the trace tree and create point features for nodes, addresses, and residential units.
	 * @param {Record<string, any>} node - A trace tree node containing node/address/residential_unit data and children
	 * @param {any[]} markers - Accumulator array for created marker features
	 * @returns {Promise<void>}
	 */
	async function extractMarkersFromTree(node, markers) {
		if (!node) return;

		const { default: GeoJSON } = await import('ol/format/GeoJSON');
		const format = new GeoJSON();

		const signalState = node.signal_state || null;

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
