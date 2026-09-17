<script lang="ts">
	import { IconLink } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getUnitFiberConnections } from '$lib/remote/address/residential-units.remote';

	let { unitUuid }: { unitUuid: string } = $props();

	const fiberConnections = $derived(await getUnitFiberConnections(unitUuid));
</script>

<div class="card p-4 sm:p-6 space-y-4">
	<div class="flex items-center gap-3">
		<IconLink class="size-5 text-warning-500" />
		<h2 class="text-lg font-semibold">{m.section_fiber_connections()}</h2>
		{#if fiberConnections.length > 0}
			<span class="badge preset-tonal-primary text-xs ml-auto">{fiberConnections.length}</span>
		{/if}
	</div>

	{#if fiberConnections.length > 0}
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
							>{m.table_cable_name()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_fiber_absolute()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_bundle()}</th
						>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
							>{m.table_fiber()}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each fiberConnections as fc, i (i)}
						<tr class="hover:preset-tonal-primary transition-colors">
							<td class="font-medium">{fc.parent_node_name}</td>
							<td>{fc.node_name}</td>
							<td>{fc.cable_name}</td>
							<td>
								<span
									class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
								>
									{fc.fiber_number_absolute}
								</span>
							</td>
							<td>
								<span class="inline-flex items-center gap-2">
									<span
										class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
									>
										{fc.bundle_number}
									</span>
									<span
										class="size-3 rounded-full border border-surface-300-700"
										style="background-color: {fc.bundle_color_hex || '#999999'}"
									></span>
									{fc.bundle_color}
								</span>
							</td>
							<td>
								<span class="inline-flex items-center gap-2">
									<span
										class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
									>
										{fc.fiber_number}
									</span>
									<span
										class="size-3 rounded-full border border-surface-300-700"
										style="background-color: {fc.fiber_color_hex || '#999999'}"
									></span>
									{fc.fiber_color}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="md:hidden space-y-3">
			{#each fiberConnections as fc, i (i)}
				<div class="rounded-lg border border-surface-200-800 p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="font-medium text-sm">{fc.node_name}</span>
						<span class="text-xs text-surface-900-100">{fc.cable_name}</span>
					</div>
					{#if fc.parent_node_name}
						<div class="text-xs text-surface-900-100">
							{m.table_parent_node()}: {fc.parent_node_name}
						</div>
					{/if}
					<div class="flex items-center gap-3 text-xs">
						<span class="inline-flex items-center gap-1">
							{m.table_fiber_absolute()}:
							<span
								class="inline-flex items-center justify-center size-6 rounded-md bg-surface-200-800 font-mono font-medium"
							>
								{fc.fiber_number_absolute}
							</span>
						</span>
					</div>
					<div class="flex items-center gap-4 text-xs">
						<span class="inline-flex items-center gap-1.5">
							{m.table_bundle()}:
							<span
								class="inline-flex items-center justify-center size-6 rounded-md bg-surface-200-800 font-mono font-medium"
							>
								{fc.bundle_number}
							</span>
							<span
								class="size-3 rounded-full border border-surface-300-700"
								style="background-color: {fc.bundle_color_hex || '#999999'}"
							></span>
							{fc.bundle_color}
						</span>
						<span class="inline-flex items-center gap-1.5">
							{m.table_fiber()}:
							<span
								class="inline-flex items-center justify-center size-6 rounded-md bg-surface-200-800 font-mono font-medium"
							>
								{fc.fiber_number}
							</span>
							<span
								class="size-3 rounded-full border border-surface-300-700"
								style="background-color: {fc.fiber_color_hex || '#999999'}"
							></span>
							{fc.fiber_color}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-surface-300-700 p-8 text-center">
			<IconLink class="size-10 mx-auto mb-3 text-warning-500 opacity-40" />
			<p class="text-sm font-medium text-surface-900-100">
				{m.message_no_fiber_connections()}
			</p>
		</div>
	{/if}
</div>
