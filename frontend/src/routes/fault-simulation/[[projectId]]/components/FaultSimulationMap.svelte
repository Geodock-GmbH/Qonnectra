<script lang="ts">
	import type { Trench } from '$lib/remote/fault-simulation/simulation-data';
	import type { MapBrowserEvent } from 'ol';
	import type OlMap from 'ol/Map.js';
	import type RenderFeature from 'ol/render/Feature.js';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import LineString from 'ol/geom/LineString.js';

	import 'ol/ol.css';

	import { transform } from 'ol/proj.js';

	import { m } from '$lib/paraglide/messages';

	import { MapState } from '$lib/classes/MapState.svelte';
	import Map from '$lib/components/Map.svelte';
	import MapHint from '$lib/components/MapHint.svelte';
	import { syncLayerStyles } from '$lib/map/layerStyleSync';
	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import { selectedProject, trenchColorSelected } from '$lib/stores/store';
	import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';

	import FaultSimulationPopUp from './FaultSimulationPopUp.svelte';
	import { getFaultSimulationState } from './FaultSimulationState.svelte';

	let { projectId }: { projectId: string } = $props();

	const simulation = getFaultSimulationState();

	const mapState = new MapState(get(selectedProject), get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});
	const layersInitialized = mapState.initializeLayers();

	let olMap: OlMap | null = null;
	let popupPixel = $state({ x: 0, y: 0 });

	/**
	 * Moves the popup to the damage location's current position on screen.
	 */
	function updatePopupPixel(): void {
		if (!olMap || !simulation.damageMapCoordinate) return;
		const pixel = olMap.getPixelFromCoordinate(simulation.damageMapCoordinate);
		if (pixel) {
			popupPixel = { x: Math.round(pixel[0]), y: Math.round(pixel[1]) };
		}
	}

	/**
	 * Adds the simulation overlay to the map and keeps the popup anchored while the map moves.
	 * @param event - Map ready event containing the OL map instance
	 */
	function handleMapReady({ map }: { map: OlMap }): void {
		olMap = map;
		const { srid, proj4Def } = page.data;
		simulation.overlay.attach(map, srid && proj4Def ? { srid, proj4Def } : null);
		map.on('postrender', updatePopupPixel);
	}

	/**
	 * Handles map clicks to select a trench as the damage location for fault simulation.
	 * @param evt - The map browser click event
	 */
	function handleMapClick(evt: MapBrowserEvent<PointerEvent>): void {
		if (!olMap || !simulation.canSelectDamagePoint) return;

		const feature = olMap.forEachFeatureAtPixel(evt.pixel, (f) => f, {
			hitTolerance: 10,
			layerFilter: (layer) => layer === mapState.vectorTileLayer
		});

		if (!feature) return;

		const { srid, proj4Def } = page.data;
		if (srid && proj4Def) {
			registerStorageProjection(srid, proj4Def);
		}

		const renderGeom = feature.getGeometry() as RenderFeature | undefined;
		let snappedCoord = evt.coordinate;
		if (renderGeom) {
			const flatCoords = renderGeom.getFlatCoordinates();
			const coords = [];
			for (let i = 0; i < flatCoords.length; i += 2) {
				coords.push([flatCoords[i], flatCoords[i + 1]]);
			}
			if (coords.length >= 2) {
				snappedCoord = new LineString(coords).getClosestPoint(evt.coordinate);
			}
		}

		const storageCoord = srid
			? transform(snappedCoord, olMap.getView().getProjection(), storageProjection(srid))
			: snappedCoord;

		const trenchProps = feature.getProperties();
		const trench: Trench = {
			id_trench: trenchProps.id_trench ?? trenchProps.label ?? '—',
			construction_type: trenchProps.construction_type ?? null,
			uuid: trenchProps.uuid ?? trenchProps.id ?? null
		};

		simulation.selectDamagePoint([storageCoord[0], storageCoord[1]], snappedCoord, trench);
		updatePopupPixel();
	}

	onMount(() => {
		const stopStyleSync = syncLayerStyles(mapState);

		return () => {
			stopStyleSync();
			olMap?.un('postrender', updatePopupPixel);
			simulation.overlay.detach();
			mapState.cleanup();
		};
	});

	const attributes = $derived(await getLayerStyleAttributes());
</script>

{#if layersInitialized}
	<div class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full relative">
		<Map
			className="rounded-lg overflow-hidden"
			layers={mapState.getLayers()}
			showLayerVisibilityTree={true}
			showSearchPanel={true}
			onready={handleMapReady}
			onclick={handleMapClick}
			nodeTypes={attributes.nodeTypes}
			surfaces={attributes.surfaces}
			constructionTypes={attributes.constructionTypes}
			areaTypes={attributes.areaTypes}
		/>

		<MapHint
			message={m.message_fault_select_trench()}
			visible={!simulation.damagePoint && !simulation.simulationResult}
		/>

		{#if simulation.damagePoint && !simulation.simulationResult}
			<div class="fault-popup" style:left="{popupPixel.x}px" style:top="{popupPixel.y}px">
				<FaultSimulationPopUp {projectId} />
				<div class="fault-popup-arrow"></div>
			</div>
		{/if}
	</div>
{:else}
	<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
		<p>{m.message_error_could_not_load_map_tiles()}</p>
	</div>
{/if}

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
