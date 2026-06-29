<script>
	import { fade } from 'svelte/transition';

	/** @type {{ visible?: boolean, message: string, class?: string }} */
	let { visible = true, message, class: className = '' } = $props();
</script>

{#if visible}
	<div
		class="absolute top-4.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none
			flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg max-w-[calc(100%-2rem)]
			bg-surface-50-950
			border border-surface-200-800
			text-surface-700 dark:text-surface-200 text-xs sm:text-sm shadow-md
			{className}"
		transition:fade={{ duration: 200 }}
	>
		<span>{message}</span>
	</div>
{/if}
