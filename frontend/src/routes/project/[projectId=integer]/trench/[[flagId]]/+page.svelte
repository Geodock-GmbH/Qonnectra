<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { selectedConduit, selectedFlag, trenchColorSelected } from '$lib/stores/store';
	import { getFieldAliases } from '$lib/utils/fieldAliases';
	import { routeProjectId } from '$lib/context/project';

	import TrenchAssignmentPanel from './components/panel/TrenchAssignmentPanel.svelte';
	import {
		setTrenchAssignment,
		TrenchAssignmentState
	} from './components/TrenchAssignmentState.svelte';
	import TrenchMap from './components/TrenchMap.svelte';
	import { setTrenchMapManagers } from './components/trenchMapContext';

	const alias = getFieldAliases();

	// The flag in the URL becomes the preferred flag; a conduit remembered
	// from another flag does not belong to the one in the URL.
	const urlFlagId = page.params.flagId;
	if (browser && urlFlagId && urlFlagId !== get(selectedFlag)?.[0]) {
		selectedFlag.set([urlFlagId]);
		selectedConduit.set(undefined);
	}

	const mapState = new MapState(routeProjectId(), get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});
	const selectionManager = new MapSelectionManager();
	const assignment = new TrenchAssignmentState(selectionManager, get(selectedConduit));

	// The search panel inside the map looks its selection manager up under this key.
	setContext('mapManagers', { mapState, selectionManager });
	setTrenchMapManagers({ mapState, selectionManager });
	setTrenchAssignment(assignment);

	const layersInitialized = mapState.initializeLayers();

	onMount(() => {
		// A URL without a flag gets the preferred one, so the picker, the
		// conduit list and the URL agree; the flag is an adjustment, so the
		// history entry is rewritten.
		const flagId = page.params.flagId ?? get(selectedFlag)?.[0];
		if (!page.params.flagId && flagId) {
			goto(
				resolve('/project/[projectId=integer]/trench/[[flagId]]', {
					projectId: routeProjectId(),
					flagId
				}),
				{ keepFocus: true, noScroll: true, replaceState: true }
			);
		}
		void assignment.validateConduit(routeProjectId(), flagId);

		return () => {
			assignment.cleanup();
			mapState.cleanup();
			selectionManager.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_conduit_connection()}</title>
</svelte:head>

{#snippet mapSkeleton()}
	<div class="h-full w-full rounded-lg placeholder animate-pulse" role="status">
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="flex flex-col lg:h-full lg:flex-row lg:gap-4">
	<div
		class="order-1 h-[40vh] shrink-0 border-2 rounded-lg border-surface-200-800 overflow-hidden relative sm:h-[45vh] lg:h-auto lg:flex-2"
	>
		{#if layersInitialized}
			<QueryBoundary pending={mapSkeleton}>
				<TrenchMap {alias} />
			</QueryBoundary>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{/if}
	</div>

	<div
		class="order-2 min-w-0 flex-1 overflow-auto border-2 rounded-lg border-surface-200-800 pb-16 md:pb-0"
	>
		<TrenchAssignmentPanel />
	</div>
</div>
