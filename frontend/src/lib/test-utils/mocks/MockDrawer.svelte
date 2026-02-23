<script>
	let { children, ...props } = $props();
</script>

<div data-testid="drawer" {...props}>
	{@render children?.()}
</div>
