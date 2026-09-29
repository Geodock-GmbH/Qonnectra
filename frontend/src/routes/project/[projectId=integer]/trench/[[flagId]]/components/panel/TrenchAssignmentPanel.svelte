<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { selectedFlag } from '$lib/stores/store';
	import { routeProjectId } from '$lib/context/project';

	import { getTrenchAssignment } from '../TrenchAssignmentState.svelte';
	import ConduitPicker from './ConduitPicker.svelte';
	import TrenchConnectionTable from './TrenchConnectionTable.svelte';
	import TrenchModeToggles from './TrenchModeToggles.svelte';

	const assignment = getTrenchAssignment();

	const flags = $derived(page.data.flags ?? []);
	const flagsError = $derived(page.data.flagsError ?? undefined);
	const projectId = $derived(routeProjectId());
	/** The flag scoping the conduits, from the URL alone. */
	const flagId = $derived(page.params.flagId);

	/**
	 * Navigates to the trench URL of the chosen flag, which is what scopes the
	 * conduit picker; the flag is also kept as the preferred one for the pages
	 * that use it as a default filter. Clearing the input keeps the current flag.
	 * @param e - The picker's selection.
	 */
	function handleFlagChange(e: { value: string[] }) {
		const next = e.value[0];
		if (!next || next === flagId) return;

		selectedFlag.set([next]);
		assignment.selectConduit(undefined);
		goto(resolve('/project/[projectId=integer]/trench/[[flagId]]', { projectId, flagId: next }), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

{#snippet pickerSkeleton()}
	<div class="placeholder animate-pulse h-10 rounded-md" role="status">
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

{#snippet tableSkeleton()}
	<div class="flex items-center justify-center h-32" role="status">
		<div class="animate-pulse text-surface-400 text-sm">{m.common_loading()}</div>
	</div>
{/snippet}

<div class="flex min-w-0 flex-col h-full">
	<div class="@container p-3 sm:p-4 space-y-3 sm:space-y-5 border-b border-surface-200-800 min-w-0">
		<TrenchModeToggles />

		<div class="grid grid-cols-1 gap-2 sm:gap-3 @min-[36rem]:grid-cols-2">
			<div class="space-y-1 sm:space-y-1.5">
				<span class="text-xs font-semibold text-surface-600-400 uppercase tracking-wide block"
					>{m.form_flag()}</span
				>
				<GenericCombobox
					data={flags}
					error={flagsError}
					errorMessage={flagsError}
					value={flagId ? [flagId] : []}
					onValueChange={handleFlagChange}
					placeholder={m.placeholder_select_flag()}
				/>
			</div>

			<div class="space-y-1 sm:space-y-1.5">
				<span class="text-xs font-semibold text-surface-600-400 uppercase tracking-wide block"
					>{m.form_conduit({ count: 1 })}</span
				>
				{#if projectId && flagId}
					<QueryBoundary pending={pickerSkeleton}>
						<ConduitPicker {projectId} {flagId} />
					</QueryBoundary>
				{:else}
					<GenericCombobox data={[]} value={[]} noDataMessage={m.message_no_conduits_found()} />
				{/if}
			</div>
		</div>
	</div>

	<div class="flex-1 min-h-0 p-3 sm:p-4 overflow-auto">
		{#if assignment.conduitUuid}
			<!-- Another conduit starts from a fresh search, sort and page. -->
			{#key assignment.conduitUuid}
				<QueryBoundary pending={tableSkeleton}>
					<TrenchConnectionTable conduitUuid={assignment.conduitUuid} />
				</QueryBoundary>
			{/key}
		{:else}
			<div class="flex items-center justify-center h-32 text-surface-400 text-sm">
				{m.message_no_trenches()}
			</div>
		{/if}
	</div>
</div>
