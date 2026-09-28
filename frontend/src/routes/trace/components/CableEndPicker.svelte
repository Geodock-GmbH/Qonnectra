<script lang="ts">
	import type { CableEndOption } from '$lib/types/trace';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	import { cableEndLabel } from './cableEnds';

	interface Props {
		/** Heading above the picker. */
		label: string;
		/** The cable ends to choose from. */
		options: CableEndOption[];
		/** UUID of the chosen cable end. */
		value: string | null | undefined;
		/** Called with the picked node's UUID, or an empty string for the backend's default. */
		onchange: (nodeId: string) => void;
	}

	let { label, options, value, onchange }: Props = $props();

	const items = $derived(
		options.map((option) => ({ value: option.id, label: cableEndLabel(option) }))
	);
	const chosen = $derived(options.find((option) => option.id === value));
</script>

<section>
	<h2
		class="mb-3 flex items-center gap-3 text-base font-semibold text-surface-900-100 sm:mb-4 sm:text-lg"
	>
		{label}
	</h2>
	<div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
		<div class="w-full min-w-0 max-w-2xl">
			<GenericCombobox
				data={items}
				value={value ? [value] : []}
				onValueChange={(e) => onchange(e.value[0] || '')}
			/>
		</div>
		{#if chosen?.type}
			<span class="shrink-0 text-sm text-surface-600-400">{chosen.type}</span>
		{/if}
	</div>
</section>
