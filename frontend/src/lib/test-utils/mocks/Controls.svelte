<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		before,
		children,
		after,
		...props
	}: { before?: Snippet; children?: Snippet; after?: Snippet; [key: string]: unknown } = $props();
</script>

<div data-testid="controls" {...props}>
	{@render before?.()}
	{@render children?.()}
	{@render after?.()}
</div>
