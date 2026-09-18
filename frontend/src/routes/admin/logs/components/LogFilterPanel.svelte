<script lang="ts">
	import type { LogFilters } from '$lib/remote/admin/logs-data';
	import type { ComboboxItem } from '$lib/types/attributeCardTypes';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	let {
		filters,
		projectOptions,
		onApply,
		onClear
	}: {
		filters: LogFilters;
		projectOptions: ComboboxItem[];
		onApply: (filters: LogFilters) => void;
		onClear: () => void;
	} = $props();

	const logLevels = [
		{ value: '', label: 'All Levels' },
		{ value: 'DEBUG', label: 'Debug' },
		{ value: 'INFO', label: 'Info' },
		{ value: 'WARNING', label: 'Warning' },
		{ value: 'ERROR', label: 'Error' },
		{ value: 'CRITICAL', label: 'Critical' }
	];

	const sources = [
		{ value: '', label: 'All Sources' },
		{ value: 'backend', label: 'Backend' },
		{ value: 'frontend', label: 'Frontend' },
		{ value: 'wfs', label: 'WFS (QGIS Server)' }
	];

	// Drafts follow the URL (back/forward, clear) but stay editable until applied.
	let level = $derived(filters.level);
	let source = $derived(filters.source);
	let search = $derived(filters.search);
	let dateFrom = $derived(filters.dateFrom);
	let dateTo = $derived(filters.dateTo);
	let project = $derived(filters.project);

	function apply() {
		onApply({ ...filters, level, source, search, dateFrom, dateTo, project });
	}
</script>

<div class="preset-filled-surface-50-950 rounded-lg shadow p-4 mb-6">
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<div>
			<span class="block text-sm font-medium mb-1">{m.form_level()}</span>
			<GenericCombobox
				data={logLevels}
				value={[level]}
				onValueChange={(e) => {
					level = e.value[0] || '';
				}}
			/>
		</div>

		<div>
			<span class="block text-sm font-medium mb-1">{m.form_source()}</span>
			<GenericCombobox
				data={sources}
				value={[source]}
				onValueChange={(e) => {
					source = e.value[0] || '';
				}}
			/>
		</div>

		<div>
			<span class="block text-sm font-medium mb-1">{m.form_project({ count: 1 })}</span>
			<GenericCombobox
				data={projectOptions}
				value={[project]}
				onValueChange={(e) => {
					project = e.value[0] || '';
				}}
			/>
		</div>

		<div>
			<label for="search" class="block text-sm font-medium mb-1">{m.common_search()}</label>
			<input
				id="search"
				type="text"
				bind:value={search}
				placeholder={m.common_searching()}
				class="input w-full"
			/>
		</div>

		<div>
			<label for="dateFrom" class="block text-sm font-medium mb-1">{m.form_date_from()}</label>
			<input id="dateFrom" type="datetime-local" bind:value={dateFrom} class="input w-full" />
		</div>

		<div>
			<label for="dateTo" class="block text-sm font-medium mb-1">{m.form_date_to()}</label>
			<input id="dateTo" type="datetime-local" bind:value={dateTo} class="input w-full" />
		</div>
	</div>

	<div class="mt-4 flex flex-col sm:flex-row gap-2">
		<button type="button" onclick={apply} class="btn preset-filled-primary-500">
			{m.action_apply_filters()}
		</button>
		<button type="button" onclick={onClear} class="btn preset-filled-surface-500">
			{m.action_clear_filters()}
		</button>
	</div>
</div>
