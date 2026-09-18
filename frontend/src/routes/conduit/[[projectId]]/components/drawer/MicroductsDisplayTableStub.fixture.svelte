<script lang="ts">
	import type { Microduct, MicroductStatusOption } from '$lib/remote/conduit/microduct-data';

	// Stand-in for MicroductsDisplayTable: lists the rows and exposes one
	// button per row to set the first status and one to clear it.
	let {
		microducts = [],
		statusOptions = [],
		onStatusChange = null
	}: {
		microducts?: Microduct[];
		statusOptions?: MicroductStatusOption[];
		onStatusChange?: ((microduct: Microduct, statusId: number | null) => void) | null;
	} = $props();
</script>

<ul>
	{#each statusOptions as option (option.id)}
		<li data-testid={`status-option-${option.id}`}>{option.microduct_status}</li>
	{/each}
</ul>
<ul>
	{#each microducts as microduct (microduct.uuid)}
		<li data-testid={`microduct-${microduct.uuid}`}>
			{microduct.number}
			<button
				type="button"
				data-testid={`set-status-${microduct.uuid}`}
				onclick={() => onStatusChange?.(microduct, statusOptions[0]?.id ?? null)}
			>
				set
			</button>
			<button
				type="button"
				data-testid={`clear-status-${microduct.uuid}`}
				onclick={() => onStatusChange?.(microduct, null)}
			>
				clear
			</button>
		</li>
	{/each}
</ul>
