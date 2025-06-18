<script>
	// Skeleton
	import { Pagination, Switch } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconTrash, IconCheck, IconX } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { selectedProject, selectedFlag, selectedConduit } from '$lib/stores/store';
	import { PUBLIC_API_URL } from '$env/static/public';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import ConduitCombobox from '$lib/components/ConduitCombobox.svelte';
	import TrenchTable from '$lib/components/TrenchTable.svelte';
	import Map from '$lib/components/Map.svelte';

	let { data } = $props();

	function handleFlagChange() {
		$selectedConduit = undefined;
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
	<div class="md:col-span-8 border-2 rounded-lg border-surface-200-800 overflow-hidden">
		<Map />
	</div>
	<div class="md:col-span-4 border-2 rounded-lg border-surface-200-800 overflow-auto">
		<div class="card p-4 flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<h3>{m.flag()}</h3>
				<Switch name="routing-mode">
					{#snippet inactiveChild()}
						<IconX size="18" />
					{/snippet}
					{#snippet activeChild()}
						<IconCheck size="18" />
					{/snippet}
				</Switch>
			</div>
			<FlagCombobox flags={data.flags} flagsError={data.flagsError} onchange={handleFlagChange} />
			<h3>{m.conduit()}</h3>
			<ConduitCombobox projectId={$selectedProject} flagId={$selectedFlag} />
			<TrenchTable conduitId={$selectedConduit} />
			<!-- TODO: Call API with button to update db data -->
			<button type="button" class="btn preset-filled-primary-500">Button</button>
		</div>
	</div>
</div>
