<script lang="ts">
	import type { ComponentProps } from 'svelte';

	import CableDiagramEdge from './CableDiagramEdge.svelte';

	let { edgeProps }: { edgeProps: ComponentProps<typeof CableDiagramEdge> } = $props();
</script>

<svg data-testid="edge-svg">
	<CableDiagramEdge {...edgeProps} />
</svg>
