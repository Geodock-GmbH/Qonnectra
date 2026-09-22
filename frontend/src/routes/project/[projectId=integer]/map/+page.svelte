<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import { MapInteractionManager } from '$lib/classes/MapInteractionManager.svelte';
	import { MapPopupManager } from '$lib/classes/MapPopupManager.svelte.js';
	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { MAP_FEATURE_KINDS } from '$lib/map/featureDetails';
	import { globalMapView, trenchColorSelected } from '$lib/stores/store';
	import { getFieldAliases } from '$lib/utils/fieldAliases';
	import { closeFeature, openFeature, queryFeature } from '$lib/utils/urlState';
	import { routeProjectId } from '$lib/context/project';

	import MapDrawerTabs from './components/drawer/MapDrawerTabs.svelte';
	import FeatureMap from './components/FeatureMap.svelte';

	let { data }: { data: PageData } = $props();

	const alias = getFieldAliases();

	// `?feature=kind:uuid` is the drawer: present means open with that feature.
	const feature = $derived(queryFeature(page.url, MAP_FEATURE_KINDS));
	let drawerTitle = $state('');
	// In the global view the open feature may belong to another project.
	const lookupProjectId = $derived($globalMapView ? '' : routeProjectId());

	const mapState = new MapState(
		routeProjectId(),
		get(trenchColorSelected),
		null,
		null,
		get(globalMapView)
	);
	const selectionManager = new MapSelectionManager();
	const popupManager = new MapPopupManager(alias);
	// A click reports the feature; the URL opens the drawer and, through
	// `FeatureMap`, keeps the selection in step.
	const interactionManager = new MapInteractionManager(selectionManager, popupManager, {
		onFeatureSelected: openFeature,
		onSelectionCleared: closeFeature
	});

	setContext('mapManagers', {
		mapState,
		selectionManager,
		popupManager,
		interactionManager
	});

	const layersInitialized = mapState.initializeLayers();

	onMount(() => {
		return () => {
			mapState.cleanup();
			selectionManager.cleanup();
			if (mapState.olMap) popupManager.cleanup(mapState.olMap);
			interactionManager.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_map()}</title>
</svelte:head>

{#snippet mapSkeleton()}
	<div
		class="h-full w-full rounded-lg border-2 border-surface-200-800 placeholder animate-pulse"
		role="status"
	>
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="relative flex gap-4 h-full overflow-hidden">
	<div class="flex-1 h-full">
		{#if layersInitialized}
			<QueryBoundary pending={mapSkeleton}>
				<FeatureMap {alias} />
			</QueryBoundary>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{/if}
	</div>

	<Drawer open={feature !== null} title={feature ? drawerTitle : ''} onclose={closeFeature}>
		{#if feature}
			{#key feature.id}
				<QueryBoundary>
					<MapDrawerTabs
						kind={feature.kind}
						uuid={feature.id}
						{lookupProjectId}
						{alias}
						projects={data.projects}
						bind:title={drawerTitle}
					/>
				</QueryBoundary>
			{/key}
		{/if}
	</Drawer>
</div>
