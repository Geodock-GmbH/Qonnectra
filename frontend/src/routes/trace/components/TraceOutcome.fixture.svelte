<script lang="ts">
	import type { TraceRequest } from './traceOptions';
	import type { TraceSelection } from './TraceSelection.svelte';
	import { untrack } from 'svelte';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import TraceOutcome from './TraceOutcome.svelte';
	import { setTraceSelection } from './TraceSelection.svelte';

	let { request, selection }: { request: TraceRequest; selection: TraceSelection } = $props();

	setTraceSelection(untrack(() => selection));
</script>

<QueryBoundary>
	<TraceOutcome {request} />
</QueryBoundary>
