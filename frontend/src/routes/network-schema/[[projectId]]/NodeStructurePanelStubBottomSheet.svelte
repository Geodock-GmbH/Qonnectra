<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title = '',
		children
	}: {
		open?: string | boolean | null;
		title?: string;
		children?: Snippet;
	} = $props();
</script>

<div data-testid="bottom-sheet" data-open={open ? String(open) : ''}>
	<div data-testid="bottom-sheet-title">{title}</div>
	{#if children}{@render children()}{/if}
</div>
