<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';

	let {
		children,
		name,
		checked,
		onCheckedChange,
		...props
	}: {
		children?: Snippet;
		name?: any;
		checked?: any;
		onCheckedChange?: any;
		[key: string]: any;
	} = $props();
	// svelte-ignore state_referenced_locally
	setContext('switch', { name, checked });
</script>

<div data-testid="switch" data-name={name} data-checked={checked} {...props}>
	{@render children?.()}
</div>
