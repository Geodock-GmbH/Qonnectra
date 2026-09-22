<script module lang="ts">
	import type OlMap from 'ol/Map.js';

	/**
	 * The map handed to `onready`; tests shape it before rendering. With
	 * `deferred` set, the map only reports ready once the test calls `announce`.
	 */
	export const readyMap: {
		current: Partial<OlMap>;
		deferred: boolean;
		announce: () => void;
	} = { current: {}, deferred: false, announce: () => {} };
</script>

<script lang="ts">
	import type { MapBrowserEvent } from 'ol';
	import { onMount } from 'svelte';

	// Stands in for `$lib/components/Map.svelte`: reports a ready map on mount
	// and turns a DOM click into a map click at a fixed pixel.
	let {
		onready,
		onclick,
		nodeTypes
	}: {
		onready?: (info: { map: OlMap; usingFallbackOSM: boolean }) => void;
		onclick?: (event: MapBrowserEvent<PointerEvent>) => void;
		nodeTypes?: unknown[];
		[key: string]: unknown;
	} = $props();

	onMount(() => {
		readyMap.announce = () =>
			onready?.({ map: readyMap.current as OlMap, usingFallbackOSM: false });
		if (!readyMap.deferred) readyMap.announce();
	});
</script>

<button
	type="button"
	data-testid="map"
	aria-label="map"
	data-node-type-count={nodeTypes?.length}
	onclick={() => onclick?.({ pixel: [5, 5] } as unknown as MapBrowserEvent<PointerEvent>)}
></button>
