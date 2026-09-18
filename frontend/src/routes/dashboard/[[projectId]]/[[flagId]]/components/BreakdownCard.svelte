<script lang="ts">
	import DashboardCard from './DashboardCard.svelte';

	/** A headline figure above the breakdown, e.g. "12,50 km total length". */
	interface Total {
		value: string;
		label: string;
	}

	/** One breakdown row; `value` sizes the bar relative to the largest row. */
	interface Row {
		key: string;
		label: string;
		sublabel?: string;
		value: number;
		display: string;
	}

	let { title, totals, rows }: { title: string; totals: Total[]; rows: Row[] } = $props();

	const max = $derived(Math.max(...rows.map((row) => row.value)) || 1);
</script>

<DashboardCard {title}>
	<div class="flex items-baseline gap-4 mb-4">
		{#each totals as total (total.label)}
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-bold text-surface-900-100">{total.value}</span>
				<span class="text-sm text-surface-600-300">{total.label}</span>
			</div>
		{/each}
	</div>
	<div class="space-y-2 overflow-auto max-h-100 pr-2">
		{#each rows as row (row.key)}
			<div class="relative rounded-lg overflow-hidden">
				<div
					class="absolute inset-y-0 left-0 bg-primary-500/20"
					style:width="{(row.value / max) * 100}%"
				></div>
				<div class="relative flex justify-between items-center p-3">
					<div>
						<div class="font-medium text-surface-900-100 text-sm">{row.label}</div>
						{#if row.sublabel}
							<div class="text-xs text-surface-600-300">{row.sublabel}</div>
						{/if}
					</div>
					<div class="font-semibold text-surface-900-100 tabular-nums">{row.display}</div>
				</div>
			</div>
		{/each}
	</div>
</DashboardCard>
