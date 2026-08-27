<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, ...props }: { children?: Snippet; [key: string]: any } = $props();
</script>

<div data-testid="svelte-flow" {...props}>
	{@render children?.()}
</div>
