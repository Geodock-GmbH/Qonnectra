<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title = '',
		children
	}: {
		open?: boolean;
		title?: string;
		children?: Snippet;
	} = $props();
</script>

<div data-testid="bottom-sheet" data-open={String(open)}>
	<div data-testid="bottom-sheet-title">{title}</div>
	<button type="button" onclick={() => (open = false)}>close-sheet</button>
	{#if children}{@render children()}{/if}
</div>
