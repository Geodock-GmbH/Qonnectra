<script>
	let { children, ...rest } = $props();
</script>

<div data-testid="stub" data-props={JSON.stringify(Object.keys(rest))}>
	{#if children}{@render children()}{/if}
</div>
