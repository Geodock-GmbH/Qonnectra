<script lang="ts">
	import type { ComboboxItem } from '$lib/types/attributeCardTypes';

	let {
		data = [],
		onValueChange
	}: {
		data?: ComboboxItem[];
		onValueChange?: (e: { value: string[] }) => void;
	} = $props();

	/**
	 * Mirrors the real Skeleton combobox, which always emits string values
	 * regardless of the option `.value` type. The regression this stub guards
	 * is the caller trusting that string to already be a number.
	 * @param e - The native change event.
	 */
	function handleChange(e: Event) {
		const target = e.currentTarget as HTMLSelectElement;
		onValueChange?.({ value: [target.value] });
	}
</script>

<select data-testid="combobox-stub" onchange={handleChange}>
	{#each data as item (item.value)}
		<option value={String(item.value)}>{item.label}</option>
	{/each}
</select>
