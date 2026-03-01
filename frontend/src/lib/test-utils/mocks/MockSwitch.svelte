<script>
	import { setContext } from 'svelte';

	let { children, name, checked, onCheckedChange, ...props } = $props();
	// svelte-ignore state_referenced_locally
	setContext('switch', { name, checked });
</script>

<div data-testid="switch" data-name={name} data-checked={checked} {...props}>
	{@render children?.()}
</div>
