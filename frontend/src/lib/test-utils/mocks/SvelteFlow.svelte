<script>
	let { children, ...props } = $props();
</script>

<div data-testid="svelte-flow" {...props}>
	{@render children?.()}
</div>
