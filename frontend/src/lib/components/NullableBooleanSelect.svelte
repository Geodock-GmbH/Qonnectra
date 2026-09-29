<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	interface Props {
		/** The flag: `true`, `false`, or `null` while unknown. */
		value?: boolean | null;
		/** Renders the option list in place instead of in a portal, as in drawers and dialogs. */
		renderInPlace?: boolean;
	}

	let { value = $bindable(null), renderInPlace = true }: Props = $props();

	/** Option value standing for `null`; a real option, since the combobox cannot be cleared. */
	const UNKNOWN = 'unknown';

	const options = [
		{ value: UNKNOWN, label: m.common_unknown() },
		{ value: 'true', label: m.common_yes() },
		{ value: 'false', label: m.common_no() }
	];

	/**
	 * The combobox selection for a flag.
	 * @param flag - The current flag.
	 */
	function toSelection(flag: boolean | null): string[] {
		return [flag === null ? UNKNOWN : String(flag)];
	}

	/**
	 * The flag behind a combobox selection; an empty or unknown selection is `null`.
	 * @param selection - The combobox value array.
	 */
	function fromSelection(selection: string[]): boolean | null {
		const option = selection[0] ?? '';
		if (option === 'true') return true;
		if (option === 'false') return false;
		return null;
	}
</script>

<GenericCombobox
	data={options}
	value={toSelection(value)}
	onValueChange={(e) => (value = fromSelection(e.value))}
	{renderInPlace}
/>
