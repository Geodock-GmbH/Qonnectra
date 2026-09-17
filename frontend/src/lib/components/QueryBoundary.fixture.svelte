<script lang="ts">
	import QueryBoundary from './QueryBoundary.svelte';

	let { load }: { load: () => Promise<string> } = $props();
</script>

<QueryBoundary>
	<p data-testid="content">{await load()}</p>
</QueryBoundary>
