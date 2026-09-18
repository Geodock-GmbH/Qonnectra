<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import VirtualCombobox from '$lib/components/VirtualCombobox.svelte';
	import { getConduitOptions } from '$lib/remote/trench/conduit-options.remote';

	import { getTrenchAssignment } from '../TrenchAssignmentState.svelte';

	let { projectId, flagId }: { projectId: string; flagId: string } = $props();

	const assignment = getTrenchAssignment();

	const conduits = $derived(await getConduitOptions({ projectId, flagId }));
</script>

{#if conduits.length === 0}
	<GenericCombobox data={[]} value={[]} noDataMessage={m.message_no_conduits_found()} />
{:else}
	<VirtualCombobox
		data={conduits}
		value={assignment.conduitUuid ?? ''}
		onValueChange={(e) => assignment.selectConduit(e.value || undefined)}
		placeholder={m.placeholder_select_conduit()}
	/>
{/if}
