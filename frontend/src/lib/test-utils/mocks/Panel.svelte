<script>
	let { children, position, ...props } = $props();
</script>

<div data-testid="panel" data-position={position} {...props}>
	{@render children?.()}
</div>
