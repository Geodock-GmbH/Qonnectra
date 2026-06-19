<script>
	import { browser, dev } from '$app/environment';
	import { page } from '$app/stores';
	import Feature from 'ol/Feature.js';
	import GeoJSON from 'ol/format/GeoJSON.js';
	import LineString from 'ol/geom/LineString.js';
	import Point from 'ol/geom/Point.js';
	import VectorLayer from 'ol/layer/Vector.js';

	import 'ol/ol.css';

	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { transform } from 'ol/proj.js';
	import VectorSource from 'ol/source/Vector.js';
	import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js';

	import { m } from '$lib/paraglide/messages';

	import { MapState } from '$lib/classes/MapState.svelte.js';
	import Map from '$lib/components/Map.svelte';
	import MapHint from '$lib/components/MapHint.svelte';
	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import {
		addressStyle,
		areaTypeStyles,
		labelVisibilityConfig,
		nodeTypeStyles,
		selectedProject,
		trenchColor,
		trenchColorSelected,
		trenchConstructionTypeStyles,
		trenchStyleMode,
		trenchSurfaceStyles
	} from '$lib/stores/store';

	import DamageReport from './DamageReport.svelte';
	import FaultSimulationPopUp from './FaultSimulationPopUp.svelte';
	import { createFaultSimulationContext } from './faultSimulationContext.svelte.js';

	let { data } = $props();

	const nodeTypes = $derived(/** @type {any[]} */ (data.nodeTypes ?? []));
	const surfaces = $derived(/** @type {any[]} */ (data.surfaces ?? []));
	const constructionTypes = $derived(/** @type {any[]} */ (data.constructionTypes ?? []));
	const areaTypes = $derived(/** @type {any[]} */ (data.areaTypes ?? []));

	if (browser && $page.params.projectId && $page.params.projectId !== get(selectedProject)) {
		selectedProject.set($page.params.projectId);
	}

	const mapState = new MapState($selectedProject, get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});

	const layersInitialized = mapState.initializeLayers();

	const ctx = createFaultSimulationContext();

	/** @type {import('ol/Map').default|null} */
	let olMap = $state(null);
	/** @type {VectorLayer|null} */
	let damagePointLayer = $state(null);
	/** @type {VectorLayer|null} */
	let affectedTrenchLayer = $state(null);
	/** @type {VectorLayer|null} */
	let affectedNodeLayer = $state(null);
	/** @type {VectorLayer|null} */
	let affectedAddressLayer = $state(null);
	/** @type {[number, number]|null} */
	let damageMapCoord = $state(null);
	let popupPixel = $state({ x: 0, y: 0 });
	/** @type {(() => void)|null} */
	let mapMoveListener = null;

	const damagePointStyle = new Style({
		image: new CircleStyle({
			radius: 10,
			fill: new Fill({ color: 'rgba(220, 38, 38, 0.9)' }),
			stroke: new Stroke({ color: '#ffffff', width: 3 })
		})
	});

	const affectedTrenchStyle = new Style({
		stroke: new Stroke({ color: 'rgba(220, 38, 38, 0.8)', width: 5 })
	});

	const affectedNodeDefaultStyle = new Style({
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: 'rgba(234, 88, 12, 0.9)' }),
			stroke: new Stroke({ color: '#ffffff', width: 2 })
		})
	});

	const affectedNodeAddressStyle = new Style({
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: 'rgba(147, 51, 234, 0.9)' }),
			stroke: new Stroke({ color: '#ffffff', width: 2 })
		})
	});

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @returns {Style}
	 */
	function affectedNodeStyleFn(feature) {
		return feature.get('has_address') ? affectedNodeAddressStyle : affectedNodeDefaultStyle;
	}

	const affectedAddressStyle = new Style({
		image: new CircleStyle({
			radius: 8,
			fill: new Fill({ color: 'rgba(147, 51, 234, 0.9)' }),
			stroke: new Stroke({ color: '#ffffff', width: 2 })
		})
	});

	/**
	 * Initializes overlay layers for damage point, affected trenches, nodes, and addresses.
	 * @param {{ map: import('ol/Map').default }} event - Map ready event containing the OL map instance
	 * @returns {void}
	 */
	function handleMapReady({ map }) {
		olMap = map;

		damagePointLayer = new VectorLayer({
			source: new VectorSource(),
			style: damagePointStyle,
			zIndex: 100
		});

		affectedTrenchLayer = new VectorLayer({
			source: new VectorSource(),
			style: affectedTrenchStyle,
			zIndex: 50
		});

		affectedNodeLayer = new VectorLayer({
			source: new VectorSource(),
			style: affectedNodeStyleFn,
			zIndex: 60
		});

		affectedAddressLayer = new VectorLayer({
			source: new VectorSource(),
			style: affectedAddressStyle,
			zIndex: 55
		});

		olMap.addLayer(affectedTrenchLayer);
		olMap.addLayer(affectedAddressLayer);
		olMap.addLayer(affectedNodeLayer);
		olMap.addLayer(damagePointLayer);

		mapMoveListener = () => updatePopupPixel();
		olMap.on('postrender', mapMoveListener);
	}

	/** @returns {void} */
	function updatePopupPixel() {
		if (!olMap || !damageMapCoord) return;
		const pixel = olMap.getPixelFromCoordinate(damageMapCoord);
		if (pixel) {
			popupPixel = { x: Math.round(pixel[0]), y: Math.round(pixel[1]) };
		}
	}

	/**
	 * Handles map clicks to select a trench as the damage location for fault simulation.
	 * @param {import('ol/MapBrowserEvent').default} evt - The map browser click event
	 * @returns {void}
	 */
	function handleMapClick(evt) {
		if (ctx.isSimulating || ctx.simulationResult) return;

		const feature = olMap?.forEachFeatureAtPixel(evt.pixel, (f) => f, {
			hitTolerance: 10,
			layerFilter: (layer) => layer === mapState.vectorTileLayer
		});

		if (!feature) return;

		const srid = $page.data.srid;
		const proj4Def = $page.data.proj4Def;
		if (srid && proj4Def) {
			registerStorageProjection(srid, proj4Def);
		}

		const renderGeom = /** @type {any} */ (feature.getGeometry());
		let snappedCoord = evt.coordinate;
		if (renderGeom) {
			const flatCoords = renderGeom.getFlatCoordinates();
			const coords = [];
			for (let i = 0; i < flatCoords.length; i += 2) {
				coords.push([flatCoords[i], flatCoords[i + 1]]);
			}
			if (coords.length >= 2) {
				const line = new LineString(coords);
				snappedCoord = /** @type {[number, number]} */ (line.getClosestPoint(evt.coordinate));
			}
		}

		const proj = storageProjection(srid);
		let storageCoord = snappedCoord;
		if (proj && olMap) {
			storageCoord = transform(snappedCoord, olMap.getView().getProjection(), proj);
		}

		const trenchProps = feature.getProperties();
		const trenchInfo = {
			id_trench: trenchProps.id_trench ?? trenchProps.label ?? '—',
			construction_type: trenchProps.construction_type ?? null,
			uuid: trenchProps.uuid ?? trenchProps.id ?? null
		};

		ctx.setDamagePoint(/** @type {[number, number]} */ (storageCoord), trenchInfo);
		damageMapCoord = /** @type {[number, number]} */ (snappedCoord);

		const damageSource = damagePointLayer?.getSource();
		if (damageSource) {
			damageSource.clear();
			damageSource.addFeature(new Feature({ geometry: new Point(snappedCoord) }));
		}

		updatePopupPixel();
		clearResultLayers();
	}

	/** @returns {void} */
	function clearResultLayers() {
		affectedTrenchLayer?.getSource()?.clear();
		affectedNodeLayer?.getSource()?.clear();
		affectedAddressLayer?.getSource()?.clear();
	}

	/** @returns {void} */
	function clearAllLayers() {
		damagePointLayer?.getSource()?.clear();
		clearResultLayers();
	}

	$effect(() => {
		const result = ctx.simulationResult;
		if (!result || !olMap) return;

		clearResultLayers();

		const srid = $page.data.srid;
		const proj4Def = $page.data.proj4Def;
		if (srid && proj4Def) {
			registerStorageProjection(srid, proj4Def);
		}

		const format = new GeoJSON();
		const proj = storageProjection(srid);
		const readOptions = proj
			? { dataProjection: proj, featureProjection: olMap.getView().getProjection() }
			: {};

		const trenchFeatures = result.geometry?.affected_trenches;
		if (trenchFeatures && affectedTrenchLayer) {
			const features = format.readFeatures(trenchFeatures, readOptions);
			affectedTrenchLayer.getSource()?.addFeatures(features);
		}

		const nodeFeatures = result.geometry?.affected_nodes;
		if (nodeFeatures && affectedNodeLayer) {
			const features = format.readFeatures(nodeFeatures, readOptions);
			affectedNodeLayer.getSource()?.addFeatures(features);
		}

		const addressFeatures = result.geometry?.affected_addresses;
		if (addressFeatures && affectedAddressLayer) {
			const features = format.readFeatures(addressFeatures, readOptions);
			affectedAddressLayer.getSource()?.addFeatures(features);
		}
	});

	$effect(() => {
		if (!ctx.damagePoint && !ctx.simulationResult) {
			clearAllLayers();
			damageMapCoord = null;
		}
	});

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
		if (config.conduit !== undefined) {
			mapState.updateLabelVisibility('conduit', config.conduit, {
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

	onMount(() => {
		if (dev) {
			/** @type {any} */ (window).__e2eFaultSim = {
				/** @param {Record<string, any>} result */
				injectResult(result) {
					ctx.setDamagePoint([0, 0], result.trench ?? null);
					ctx.setSimulationResult(result);
				},
				reset() {
					ctx.reset();
				}
			};
		}

		return () => {
			if (dev) {
				delete /** @type {any} */ (window).__e2eFaultSim;
			}
			if (olMap && mapMoveListener) {
				olMap.un('postrender', mapMoveListener);
			}
			mapState.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_fault_simulation()}</title>
</svelte:head>

<div class="flex flex-col h-full overflow-hidden">
	<div class={ctx.simulationResult ? 'h-1/2 shrink-0' : 'flex-1'}>
		{#if data.error && !layersInitialized}
			<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
				<p>Error loading initial map data: {data.error}</p>
			</div>
		{:else if layersInitialized}
			<div class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full relative">
				<Map
					className="rounded-lg overflow-hidden"
					layers={mapState.getLayers()}
					showLayerVisibilityTree={true}
					showSearchPanel={true}
					onready={handleMapReady}
					onclick={handleMapClick}
					{nodeTypes}
					{surfaces}
					{constructionTypes}
					{areaTypes}
				/>

				<MapHint
					message={m.message_fault_select_trench()}
					visible={!ctx.damagePoint && !ctx.simulationResult}
				/>

				{#if ctx.damagePoint && !ctx.simulationResult}
					<div class="fault-popup" style="left: {popupPixel.x}px; top: {popupPixel.y}px;">
						<FaultSimulationPopUp projectId={$page.params.projectId ?? get(selectedProject)} />
						<div class="fault-popup-arrow"></div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{/if}
	</div>

	{#if ctx.simulationResult}
		<div class="flex-1 min-h-0 border-t border-surface-200-800 mt-2">
			<DamageReport
				projectId={$page.params.projectId ?? get(selectedProject)}
				onreset={() => ctx.reset()}
			/>
		</div>
	{/if}
</div>

<style>
	.fault-popup {
		position: absolute;
		z-index: 10;
		pointer-events: auto;
		transform: translate(-50%, calc(-100% - 16px));
	}

	.fault-popup-arrow {
		position: absolute;
		bottom: -8px;
		left: 50%;
		transform: translateX(-50%);
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-top: 8px solid rgb(var(--color-surface-200));
	}

	:global(.dark) .fault-popup-arrow {
		border-top-color: rgb(var(--color-surface-800));
	}
</style>
