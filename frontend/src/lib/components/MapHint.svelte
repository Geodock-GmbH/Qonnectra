<script>
	import { fade } from 'svelte/transition';
	import { IconPointer } from '@tabler/icons-svelte';

	/** @type {{ visible?: boolean, message: string, icon?: typeof IconPointer, class?: string }} */
	let { visible = true, message, icon = IconPointer, class: className = '' } = $props();
</script>

{#if visible}
	<div
		class="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none
			flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full max-w-[calc(100%-2rem)]
			bg-surface-50/80 dark:bg-surface-800/80 backdrop-blur-sm
			border border-surface-300 dark:border-surface-600
			text-surface-700 dark:text-surface-200 text-xs sm:text-sm shadow-lg
			{className}"
		transition:fade={{ duration: 200 }}
	>
		{#if icon}
			{@const Icon = icon}
			<span class="shrink-0"><Icon size={18} /></span>
		{/if}
		<span>{message}</span>
	</div>
{/if}
