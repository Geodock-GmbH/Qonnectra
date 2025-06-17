<script>
	// Svelte
	import { enhance } from '$app/forms';
	import { selectedProject, selectedFlag } from '$lib/stores/store';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import ConduitCombobox from '$lib/components/ConduitCombobox.svelte';
	import Map from '$lib/components/Map.svelte';

	let { data, form } = $props();
	let selectedConduit = $state(null);
	let conduitFormEl;

	let conduits = $state(form?.conduits || data.conduits || []);
	let conduitsError = $state(form?.conduitsError || data.conduitsError || null);
	let loadingConduits = $state(false);

	function handleConduitSelect(conduit) {
		selectedConduit = conduit;
		console.log('Selected conduit:', conduit);
	}

	$effect(() => {
		if ($selectedProject && $selectedFlag) {
			// programmatically submit the form
			if (conduitFormEl) {
				conduitFormEl.requestSubmit();
			}
		} else {
			conduits = [];
			conduitsError = null;
		}
	});

	$effect(() => {
		if (form?.conduits) {
			conduits = form.conduits;
		}
		if (form?.conduitsError) {
			conduitsError = form.conduitsError;
		}
	});
</script>

<!-- Hidden form to fetch conduits -->
<form
	method="POST"
	action="?/getConduits"
	bind:this={conduitFormEl}
	use:enhance={() => {
		loadingConduits = true;
		return async ({ update }) => {
			await update();
			loadingConduits = false;
		};
	}}
>
	<input type="hidden" name="projectId" value={$selectedProject} />
	<input type="hidden" name="flagId" value={$selectedFlag} />
</form>

<div class="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
	<div class="md:col-span-8 border-2 rounded-lg border-surface-200-800 overflow-hidden">
		<Map />
	</div>
	<div class="md:col-span-4 border-2 rounded-lg border-surface-200-800">
		<div class="card w-full p-4 space-y-4">
			<div>
				<h3 class="h3 mb-2">Select Flag</h3>
				<FlagCombobox flags={data.flags} flagsError={data.flagsError} />
			</div>

			<div>
				<h3 class="h3 mb-2">Search Conduit</h3>
				<ConduitCombobox
					{conduits}
					{conduitsError}
					loading={loadingConduits}
					onSelect={handleConduitSelect}
					placeholder="Type to search conduits..."
				/>
			</div>

			{#if selectedConduit}
				<div class="card variant-filled-secondary p-3">
					<h4 class="h4 mb-2">Selected Conduit</h4>
					<p><strong>Name:</strong> {selectedConduit.name}</p>
					<p><strong>Type:</strong> {selectedConduit.conduit_type?.conduit_type || 'N/A'}</p>
					<p><strong>Status:</strong> {selectedConduit.status?.status || 'N/A'}</p>
					<p><strong>UUID:</strong> {selectedConduit.uuid}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
