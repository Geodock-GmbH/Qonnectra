<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, position, ...props }: { children?: Snippet; position?: any; [key: string]: any } =
		$props();
</script>

<div data-testid="panel" data-position={position} {...props}>
	{@render children?.()}
</div>
