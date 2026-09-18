<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	const ALL_FLAGS = 'all';

	let { projectId, flagId }: { projectId: string; flagId: string } = $props();

	const options = $derived([
		{ value: ALL_FLAGS, label: m.form_all_flags() },
		...(page.data.flags ?? [])
	]);

	/**
	 * Navigates to the dashboard URL of the chosen flag; the URL is what scopes
	 * the statistics. Clearing the input keeps the current scope.
	 */
	function handleFlagChange(e: { value: string[] }) {
		const next = e.value[0];
		if (!next) return;

		const params = next === ALL_FLAGS ? { projectId } : { projectId, flagId: next };
		goto(resolve('/dashboard/[[projectId]]/[[flagId]]', params), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

<label class="flex items-center gap-3">
	<span class="text-xs font-semibold text-surface-600-400 uppercase tracking-wide">
		{m.form_flag()}
	</span>
	<div class="w-56">
		<GenericCombobox
			data={options}
			value={[flagId || ALL_FLAGS]}
			error={page.data.flagsError}
			disabled={!projectId}
			onValueChange={handleFlagChange}
			placeholder={m.placeholder_select_flag()}
		/>
	</div>
</label>
