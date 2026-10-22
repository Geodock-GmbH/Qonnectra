<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="fixed inset-0 overflow-hidden">
	{@render children()}
</div>
