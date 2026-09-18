<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { derived, get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import {
		selectedConduit,
		selectedFlag,
		selectedProject,
		trenchColorSelected
	} from '$lib/stores/store';
	import { getFieldAliases } from '$lib/utils/fieldAliases';

	import TrenchAssignmentPanel from './components/panel/TrenchAssignmentPanel.svelte';
	import {
		setTrenchAssignment,
		TrenchAssignmentState
	} from './components/TrenchAssignmentState.svelte';
	import TrenchMap from './components/TrenchMap.svelte';
	import { setTrenchMapManagers } from './components/trenchMapContext';

	const alias = getFieldAliases();

	// A conduit remembered from another project or flag does not belong to the one in the URL.
	const urlProjectId = page.params.projectId;
	const urlFlagId = page.params.flagId;
	if (browser && urlProjectId && urlProjectId !== get(selectedProject)) {
		selectedProject.set(urlProjectId);
		selectedConduit.set(undefined);
	}
	if (browser && urlFlagId && urlFlagId !== get(selectedFlag)?.[0]) {
		selectedFlag.set([urlFlagId]);
		selectedConduit.set(undefined);
	}

	const mapState = new MapState(get(selectedProject), get(trenchColorSelected), {
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

	const trenchScope = derived([selectedProject, selectedFlag], ([projectId, flag]) =>
		projectId && flag?.[0] ? { projectId, flagId: flag[0] } : null
	);

	onMount(() => {
		const stopUrlSync = trenchScope.subscribe((scope) => {
			if (!scope) return;
			if (resolve('/trench/[[projectId]]/[[flagId]]', scope) === page.url.pathname) return;

			goto(resolve('/trench/[[projectId]]/[[flagId]]', scope), {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		});

		return () => {
			stopUrlSync();
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
