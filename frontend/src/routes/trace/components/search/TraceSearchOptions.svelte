<script lang="ts">
	import { slide } from 'svelte/transition';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { GEOMETRY_MODES } from '$lib/remote/trace/trace-data';

	import { getTraceSearchState } from './TraceSearchState.svelte';

	const search = getTraceSearchState();

	const geometryModeOptions = [
		{ value: 'segments', label: m.trace_geometry_segments() },
		{ value: 'merged', label: m.trace_geometry_merged() },
		{ value: 'routed', label: m.trace_geometry_routed() }
	];

	/**
	 * Applies the geometry mode picked in the combobox, which reports strings.
	 * @param e - The combobox's value change.
	 */
	function handleGeometryModeChange(e: { value: string[] }) {
		search.geometryMode = GEOMETRY_MODES.find((mode) => mode === e.value[0]) ?? 'segments';
	}
</script>

<div class="mb-6 rounded-xl border border-surface-200-800 p-3 sm:p-4">
	<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={search.globalSearch}
				class="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
			/>
			<span class="text-sm font-medium text-surface-900-100">{m.trace_search_global()}</span>
		</label>

		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={search.includeGeometry}
				class="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
			/>
			<span class="text-sm font-medium text-surface-900-100">{m.trace_include_geometry()}</span>
		</label>

		{#if search.includeGeometry}
			<div class="flex items-center gap-2" transition:slide={{ duration: 150 }}>
				<span class="text-sm text-surface-600-400">{m.trace_geometry_mode()}:</span>
				<GenericCombobox
					data={geometryModeOptions}
					value={[search.geometryMode]}
					onValueChange={handleGeometryModeChange}
					classes="touch-manipulation w-40 sm:w-48"
				/>
			</div>

			<label class="flex cursor-pointer items-center gap-2" transition:slide={{ duration: 150 }}>
				<input
					type="checkbox"
					bind:checked={search.orientGeometry}
					class="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
				/>
				<span class="text-sm text-surface-900-100">{m.trace_orient_geometry()}</span>
			</label>
		{/if}
	</div>
</div>
