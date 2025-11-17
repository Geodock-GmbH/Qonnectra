<script>
	import { navigating } from '$app/stores';

	import { m } from '$lib/paraglide/messages';

	import DashboardCard from './DashboardCard.svelte';

	let { warranties } = $props();

	function getUrgencyClass(daysUntilExpiry) {
		if (daysUntilExpiry < 30) {
			return 'bg-error-200-800 border-error-500';
		} else if (daysUntilExpiry < 90) {
			return 'bg-warning-200-800 border-warning-500';
		}
		return 'bg-success-200-800 border-success-500';
	}

	function formatDate(dateString) {
		const date = new Date(dateString);
		return date.toLocaleDateString('de-DE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
	}
</script>

<DashboardCard title={m.form_warranty()}>
	{#if $navigating}
		{#each Array(5) as _, i (i)}
			<div class="h-16 bg-surface-500 rounded animate-pulse mb-3"></div>
		{/each}
	{:else if warranties.length === 0}
		<div class="text-center py-8 text-surface-600-300">
			<p class="text-lg">{m.form_no_warranties_expiring()}</p>
		</div>
	{:else}
		<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
			{#each warranties as warranty (warranty.id)}
				<div
					class="flex justify-between items-center p-3 rounded-lg border hover:opacity-80 transition-opacity {getUrgencyClass(
						warranty.days_until_expiry
					)}"
				>
					<div class="flex-1">
						<div class="font-medium {warranty.days_until_expiry}">
							{warranty.name}
						</div>
						{#if warranty.node_type}
							<div class="text-sm {warranty.days_until_expiry}">
								{warranty.node_type}
							</div>
						{/if}
					</div>
					<div class="text-right">
						<div class="font-bold text-lg {warranty.days_until_expiry}">
							{#if warranty.days_until_expiry === 0}
								{m.form_expires_on()} {formatDate(warranty.warranty)}
							{:else}
								{m.form_expires_in()}
								{warranty.days_until_expiry}
								{m.form_days({ count: Number(warranty.days_until_expiry) })}
							{/if}
						</div>
						<div class="text-sm {warranty.days_until_expiry}">
							{formatDate(warranty.warranty)}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</DashboardCard>
