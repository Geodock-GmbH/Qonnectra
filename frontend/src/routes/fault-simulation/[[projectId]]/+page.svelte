<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import Feature from 'ol/Feature.js';
	import GeoJSON from 'ol/format/GeoJSON.js';
	import LineString from 'ol/geom/LineString.js';
	import Point from 'ol/geom/Point.js';
	import VectorLayer from 'ol/layer/Vector.js';
	import { transform } from 'ol/proj.js';
	import VectorSource from 'ol/source/Vector.js';
	import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js';

	import { m } from '$lib/paraglide/messages';

	import { MapState } from '$lib/classes/MapState.svelte.js';
	import Map from '$lib/components/Map.svelte';
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

	import FaultSimulationSidebar from './FaultSimulationSidebar.svelte';
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

	const affectedNodeStyle = new Style({
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: 'rgba(234, 88, 12, 0.9)' }),
			stroke: new Stroke({ color: '#ffffff', width: 2 })
		})
	});

	/**
	 * Initializes overlay layers for damage point, affected trenches, and affected nodes.
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
			style: affectedNodeStyle,
			zIndex: 60
		});

		olMap.addLayer(affectedTrenchLayer);
		olMap.addLayer(affectedNodeLayer);
		olMap.addLayer(damagePointLayer);
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

		const damageSource = damagePointLayer?.getSource();
		if (damageSource) {
			damageSource.clear();
			damageSource.addFeature(new Feature({ geometry: new Point(snappedCoord) }));
		}

		clearResultLayers();
	}

	/** @returns {void} */
	function clearResultLayers() {
		affectedTrenchLayer?.getSource()?.clear();
		affectedNodeLayer?.getSource()?.clear();
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
	});

	$effect(() => {
		if (!ctx.damagePoint && !ctx.simulationResult) {
			clearAllLayers();
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
		return () => {
			mapState.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_fault_simulation()}</title>
</svelte:head>

<div class="relative flex gap-4 h-full overflow-hidden">
	<div class="flex-1 h-full">
		{#if data.error && !layersInitialized}
			<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
				<p>Error loading initial map data: {data.error}</p>
			</div>
		{:else if layersInitialized}
			<div class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full">
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
			</div>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{/if}
	</div>

	<div class="w-80 shrink-0 overflow-hidden rounded-lg border border-surface-200-800">
		<FaultSimulationSidebar projectId={$page.params.projectId ?? get(selectedProject)} />
	</div>
</div>
