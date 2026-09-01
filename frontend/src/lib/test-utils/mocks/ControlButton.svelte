<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		onclick,
		...props
	}: { children?: Snippet; onclick?: (event: MouseEvent) => void; [key: string]: unknown } =
		$props();
</script>

<button type="button" data-testid="control-button" {onclick} {...props}>
	{@render children?.()}
</button>
