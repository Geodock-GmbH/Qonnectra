<script lang="ts">
	import type { Snippet } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		title,
		resetLabel = m.common_reset_all(),
		onrandomize,
		onreset,
		children
	}: {
		title: string;
		resetLabel?: string;
		/** Bulk actions; the buttons are hidden while there is nothing to act on. */
		onrandomize?: () => void;
		onreset?: () => void;
		children: Snippet;
	} = $props();
</script>

<div>
	<div class="flex items-center justify-between">
		<h2 class="text-base/7 font-semibold text-primary-900-100">{title}</h2>
		{#if onrandomize && onreset}
			<div class="flex gap-3">
				<button
					type="button"
					class="font-semibold text-sm text-primary-500 hover:text-primary-600-400"
					onclick={onrandomize}
				>
					{m.common_randomize_all()}
				</button>
				<button
					type="button"
					class="font-semibold text-sm text-primary-500 hover:text-primary-600-400"
					onclick={onreset}
				>
					{resetLabel}
				</button>
			</div>
		{/if}
	</div>

	{@render children()}
</div>
