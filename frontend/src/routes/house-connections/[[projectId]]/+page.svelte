<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	import { m } from '$lib/paraglide/messages';

	import { MapInteractionManager } from '$lib/classes/MapInteractionManager.svelte';
	import { MapPopupManager } from '$lib/classes/MapPopupManager.svelte.js';
	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { selectedProject, trenchColorSelected } from '$lib/stores/store';
	import { getFieldAliases } from '$lib/utils/fieldAliases';

	import HouseConnectionDrawerTabs from './components/drawer/HouseConnectionDrawerTabs.svelte';
	import HouseConnectionMap from './components/HouseConnectionMap.svelte';
	import { NodeAssignmentManager } from './components/NodeAssignmentManager.svelte';
	import {
		setHouseConnectionInteraction,
		setHouseConnectionMapManagers
	} from './components/houseConnectionContext';
	import { LinkedTrenchHighlights } from './components/linkedTrenchHighlights';

	const alias = getFieldAliases();

	const mapState = new MapState(get(selectedProject), get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});
	const selectionManager = new MapSelectionManager();
	const popupManager = new MapPopupManager(alias);
	const interactionManager = new MapInteractionManager(
		selectionManager,
		popupManager,
		drawerStore,
		HouseConnectionDrawerTabs,
		alias,
		{
			trench: true,
			address: false,
			node: false,
			area: false
		}
	);
	const nodeAssignment = new NodeAssignmentManager(interactionManager);
	const trenchHighlights = new LinkedTrenchHighlights();

	setHouseConnectionMapManagers({ mapState, selectionManager, popupManager, interactionManager });
	setHouseConnectionInteraction({ nodeAssignment, trenchHighlights });

	const layersInitialized = mapState.initializeLayers();

	onMount(() => {
		return () => {
			nodeAssignment.cleanup();
			mapState.cleanup();
			selectionManager.cleanup();
			if (mapState.olMap) popupManager.cleanup(mapState.olMap);
			interactionManager.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_house_connections()}</title>
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
				<HouseConnectionMap {alias} />
			</QueryBoundary>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{/if}
	</div>

	<Drawer />
</div>
