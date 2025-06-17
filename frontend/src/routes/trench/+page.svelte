<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { selectedProject, selectedFlag } from '$lib/stores/store';
	import { PUBLIC_API_URL } from '$env/static/public';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import ConduitCombobox from '$lib/components/ConduitCombobox.svelte';
	import Map from '$lib/components/Map.svelte';

	let { data } = $props();
</script>

<div class="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
	<div class="md:col-span-8 border-2 rounded-lg border-surface-200-800 overflow-hidden">
		<Map />
	</div>
	<div class="md:col-span-4 border-2 rounded-lg border-surface-200-800">
		<div class="card p-4 flex flex-col gap-3">
			<h3>{m.flag()}</h3>
			<FlagCombobox flags={data.flags} flagsError={data.flagsError} />
			<h3>{m.conduit()}</h3>
			<ConduitCombobox
				projectId={$selectedProject}
				flagId={$selectedFlag}
				onSelect={(conduit) => console.log('Selected conduit:', conduit)}
			/>
		</div>
	</div>
</div>
