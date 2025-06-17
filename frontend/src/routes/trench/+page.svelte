<script>
	// Svelte
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import Map from '$lib/components/Map.svelte';
</script>

<div class="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
	<div class="md:col-span-8 border-2 rounded-lg border-surface-200-800 overflow-hidden">
		<Map />
	</div>
	<div class="md:col-span-4 border-2 rounded-lg border-surface-200-800">
		<div class="card w-full p-4 text-center">
			<FlagCombobox />
		</div>
	</div>
</div>
