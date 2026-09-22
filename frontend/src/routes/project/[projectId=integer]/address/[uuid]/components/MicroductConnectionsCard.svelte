<script lang="ts">
	import { IconLink } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getAddressLinks } from '$lib/remote/address/addresses.remote';

	let { uuid }: { uuid: string } = $props();

	const links = $derived(await getAddressLinks(uuid));
	const microducts = $derived(links.microducts);
</script>

<div class="card p-4 sm:p-6 space-y-4">
	<div class="flex items-center gap-3">
		<IconLink class="size-5 text-warning-500" />
		<h2 class="text-lg font-semibold">{m.section_microduct_connections()}</h2>
		{#if microducts.length > 0}
			<span class="badge preset-tonal-primary text-xs ml-auto">{microducts.length}</span>
		{/if}
	</div>

	{#if microducts.length > 0}
		<div class="hidden md:block overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_parent_node()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_node()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_conduit_name()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_conduit_type()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_microduct_number()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_color()}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each microducts as md (md.uuid)}
						<tr class="hover:preset-tonal-primary transition-colors">
							<td class="font-medium">{md.parentNodeName}</td>
							<td>{md.nodeName}</td>
							<td>{md.conduitName}</td>
							<td>{md.conduitType}</td>
							<td>
								<span
									class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
								>
									{md.number}
								</span>
							</td>
							<td>
								<span class="inline-flex items-center gap-2">
									<span
										class="size-3 rounded-full border border-surface-300-700"
										style="background-color: {md.colorHex}"
									></span>
									{md.color}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="md:hidden space-y-3">
			{#each microducts as md (md.uuid)}
				<div class="rounded-lg border border-surface-200-800 p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="font-medium text-sm">{md.nodeName}</span>
						<span class="inline-flex items-center gap-1.5">
							<span
								class="size-3 rounded-full border border-surface-300-700"
								style="background-color: {md.colorHex}"
							></span>
							<span class="text-xs">{md.color}</span>
							<span
								class="inline-flex items-center justify-center size-6 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
							>
								{md.number}
							</span>
						</span>
					</div>
					<div class="grid grid-cols-2 gap-x-4 text-xs text-surface-900-100">
						{#if md.parentNodeName}
							<span>{m.table_parent_node()}: {md.parentNodeName}</span>
						{/if}
						<span>{m.table_conduit_name()}: {md.conduitName}</span>
						<span>{m.table_conduit_type()}: {md.conduitType}</span>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-surface-300-700 p-8 text-center">
			<IconLink class="size-10 mx-auto mb-3 text-warning-500 opacity-40" />
			<p class="text-sm font-medium text-surface-900-100">
				{m.message_no_microducts_linked()}
			</p>
		</div>
	{/if}
</div>
