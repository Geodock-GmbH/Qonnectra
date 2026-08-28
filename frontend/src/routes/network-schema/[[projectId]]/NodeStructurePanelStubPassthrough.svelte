<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, ...rest }: { children?: Snippet; [key: string]: unknown } = $props();
</script>

<div data-testid="stub" data-props={JSON.stringify(Object.keys(rest))}>
	{#if children}{@render children()}{/if}
</div>
