<script lang="ts">
	import type { TraceRequest } from './traceOptions';

	let { request }: { request: TraceRequest } = $props();
</script>

<div data-testid="trace-map-panel" data-entry-type={request.entryType}></div>
