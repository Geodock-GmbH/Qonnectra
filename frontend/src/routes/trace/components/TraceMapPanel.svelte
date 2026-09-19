<script lang="ts">
	import type { TraceRequest } from './traceOptions';

	import TraceMap from './TraceMap.svelte';
	import { getTraceSelection } from './TraceSelection.svelte';
	import { traceQuery } from './traceOptions';

	let { request }: { request: TraceRequest } = $props();

	const selection = getTraceSelection();

	const traceResult = $derived(await traceQuery(request));
</script>

<TraceMap
	{traceResult}
	selectedFeatureId={selection.featureId}
	onFeatureSelect={selection.selectFeature}
/>
