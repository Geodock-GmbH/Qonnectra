<script>
	import {
		IconChevronDown,
		IconChevronRight,
		IconHome,
		IconRefresh,
		IconUsers
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getFaultSimulationContext } from './faultSimulationContext.svelte.js';

	let { projectId, onreset } = $props();

	const ctx = getFaultSimulationContext();

	const result = $derived(ctx.simulationResult);
	const summary = $derived(result?.summary);
	const conduits = $derived(result?.conduits ?? []);
	const cables = $derived(result?.cables ?? []);
	const addressDetails = $derived(result?.affected_addresses_details ?? []);

	let conduitsExpanded = $state(false);
	let cablesExpanded = $state(false);

	/**
	 * @param {Record<string, any>} addr
	 * @returns {string}
	 */
	function formatAddress(addr) {
		const parts = [addr.street, addr.housenumber];
		if (addr.suffix) parts.push(addr.suffix);
		return parts.filter(Boolean).join(' ');
	}

	/**
	 * @param {Record<string, any>} addr
	 * @returns {string}
	 */
	function formatLocation(addr) {
		const parts = [];
		if (addr.zip_code) parts.push(addr.zip_code);
		if (addr.city) parts.push(addr.city);
		return parts.join(' ');
	}
</script>

{#if result}
	<div class="flex h-full flex-col">
		<div
			class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 px-4 py-2 border-b border-surface-200-800 bg-surface-50-950 shrink-0"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2 min-w-0">
					<span class="font-semibold shrink-0">{m.nav_trench()}:</span>
					<span class="truncate">{result.trench?.id_trench ?? '—'}</span>
					{#if result.trench?.construction_type}
						<span class="opacity-60 text-sm shrink-0">({result.trench.construction_type})</span>
					{/if}
				</div>
				<button
					type="button"
					class="btn btn-sm preset-outlined-surface-200-800 shrink-0 sm:hidden"
					onclick={onreset}
				>
					<IconRefresh class="h-4 w-4" />
				</button>
			</div>

			{#if summary}
				<div class="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
					<span class="flex items-center gap-1">
						<span class="font-bold">{summary.total_cables_affected}</span>
						{m.fault_affected_cables()}
					</span>
					<span class="flex items-center gap-1">
						<IconHome class="h-4 w-4 text-error-500 shrink-0" />
						<span class="font-bold text-error-500">{summary.affected_addresses}</span>
						<span class="hidden sm:inline">{m.signal_affected_addresses()}</span>
					</span>
					<span class="flex items-center gap-1">
						<IconUsers class="h-4 w-4 text-error-500 shrink-0" />
						<span class="font-bold text-error-500">{summary.affected_residential_units}</span>
						<span class="hidden sm:inline">{m.signal_affected_rus()}</span>
					</span>
				</div>
			{/if}

			<div class="ml-auto hidden sm:block">
				<button type="button" class="btn btn-sm preset-outlined-surface-200-800" onclick={onreset}>
					<IconRefresh class="h-4 w-4" />
					{m.common_reset()}
				</button>
			</div>
		</div>

		<div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
			{#if conduits.length > 0}
				<div>
					<button
						type="button"
						class="flex items-center gap-2 text-sm font-semibold mb-2 hover:opacity-80"
						onclick={() => (conduitsExpanded = !conduitsExpanded)}
					>
						{#if conduitsExpanded}
							<IconChevronDown class="h-4 w-4" />
						{:else}
							<IconChevronRight class="h-4 w-4" />
						{/if}
						{m.fault_affected_conduits()} ({conduits.length})
					</button>

					{#if conduitsExpanded}
						<div class="flex flex-wrap gap-2">
							{#each conduits as conduit (conduit.uuid)}
								<div class="card px-3 py-2 text-sm text-left preset-outlined-surface-200-800">
									<div class="font-semibold">{conduit.name}</div>
									{#if conduit.conduit_type}
										<div class="text-xs opacity-70">{conduit.conduit_type}</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if cables.length > 0}
				<div>
					<button
						type="button"
						class="flex items-center gap-2 text-sm font-semibold mb-2 hover:opacity-80"
						onclick={() => (cablesExpanded = !cablesExpanded)}
					>
						{#if cablesExpanded}
							<IconChevronDown class="h-4 w-4" />
						{:else}
							<IconChevronRight class="h-4 w-4" />
						{/if}
						{m.fault_affected_cables()} ({cables.length})
					</button>

					{#if cablesExpanded}
						<div class="flex flex-wrap gap-2">
							{#each cables as cable (cable.uuid)}
								<div
									class="card px-3 py-2 text-sm text-left transition-colors {ctx.selectedCableId ===
									cable.uuid
										? 'preset-filled-primary-500'
										: 'preset-outlined-surface-200-800 hover:preset-tonal'}"
								>
									<div class="font-semibold">{cable.name}</div>
									<div class="text-xs opacity-70">
										{cable.cable_type ?? ''}
										{#if cable.node_start?.name || cable.node_end?.name}
											· {cable.node_start?.name ?? '—'} → {cable.node_end?.name ?? '—'}
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if summary?.total_cables_affected === 0}
				<div class="text-sm opacity-70">{m.message_no_cables_in_trench()}</div>
			{/if}

			{#if addressDetails.length > 0}
				<div>
					<h3 class="text-sm font-semibold mb-2">
						{m.signal_affected_addresses()} ({addressDetails.length})
					</h3>

					<div class="space-y-2 sm:hidden">
						{#each addressDetails as addr (addr.uuid)}
							<div class="card px-3 py-2 preset-outlined-surface-200-800">
								<div class="flex items-center justify-between gap-2">
									<a
										href="/address/{projectId}/{addr.uuid}"
										class="anchor underline font-mono text-xs"
									>
										{addr.id_address ?? '—'}
									</a>
									<span class="font-bold text-error-500 text-sm">
										{addr.residential_units?.length ?? 0}
										{m.form_residential_units()}
									</span>
								</div>
								<div class="text-sm mt-1">{formatAddress(addr)}</div>
								<div class="text-xs opacity-70">{formatLocation(addr)}</div>
								{#if addr.residential_units?.length > 0}
									<div
										class="mt-2 pl-2 border-l-2 border-surface-300 dark:border-surface-600 space-y-1"
									>
										{#each addr.residential_units as ru (ru.uuid)}
											<div class="text-xs opacity-70">
												<a
													href="/address/{projectId}/{addr.uuid}/unit/{ru.uuid}"
													class="anchor underline font-mono"
												>
													{ru.id_residential_unit ?? '—'}
												</a>
												{#if ru.floor}
													· {m.form_floor()}: {ru.floor}
												{/if}
												{#if ru.side}
													· {m.form_side()}: {ru.side}
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<div class="overflow-x-auto hidden sm:block">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-surface-200-800 text-left">
									<th class="py-2 pr-4 font-semibold">{m.form_id_address()}</th>
									<th class="py-2 pr-4 font-semibold">{m.form_street()}</th>
									<th class="py-2 pr-4 font-semibold">{m.form_city()}</th>
									<th class="py-2 pr-4 font-semibold text-right">
										{m.form_residential_units()}
									</th>
								</tr>
							</thead>
							<tbody>
								{#each addressDetails as addr (addr.uuid)}
									<tr class="border-b border-surface-200-800 hover:bg-surface-100-900">
										<td class="py-2 pr-4 font-mono text-xs">
											<a href="/address/{projectId}/{addr.uuid}" class="anchor underline">
												{addr.id_address ?? '—'}
											</a>
										</td>
										<td class="py-2 pr-4">{formatAddress(addr)}</td>
										<td class="py-2 pr-4 opacity-70">{formatLocation(addr)}</td>
										<td class="py-2 pr-4 text-right">
											<span class="font-bold text-error-500">
												{addr.residential_units?.length ?? 0}
											</span>
										</td>
									</tr>
									{#if addr.residential_units?.length > 0}
										{#each addr.residential_units as ru (ru.uuid)}
											<tr class="hover:bg-surface-100-900 text-xs">
												<td class="py-1 pr-4 pl-6 font-mono opacity-70">
													<a
														href="/address/{projectId}/{addr.uuid}/unit/{ru.uuid}"
														class="anchor underline"
													>
														{ru.id_residential_unit ?? '—'}
													</a>
												</td>
												<td class="py-1 pr-4 opacity-60">
													{#if ru.floor}
														{m.form_floor()}: {ru.floor}
													{/if}
													{#if ru.side}
														{ru.floor ? ' · ' : ''}{m.form_side()}: {ru.side}
													{/if}
												</td>
												<td class="py-1 pr-4 opacity-60">{ru.type ?? ''}</td>
												<td class="py-1 pr-4 text-right opacity-60">{ru.status ?? ''}</td>
											</tr>
										{/each}
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else if summary?.affected_addresses === 0 && summary?.affected_residential_units === 0}
				<div class="text-sm opacity-70">{m.fault_no_affected_addresses()}</div>
			{/if}
		</div>
	</div>
{/if}
