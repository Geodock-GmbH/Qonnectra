<script>
	let { open = $bindable(false), title = '', children } = $props();
</script>

<div data-testid="bottom-sheet" data-open={open ? String(open) : ''}>
	<div data-testid="bottom-sheet-title">{title}</div>
	{#if children}{@render children()}{/if}
</div>
