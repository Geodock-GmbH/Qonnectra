<script lang="ts">
	import type { PageData } from './$types';
	import type { LogFilters } from '$lib/remote/admin/logs-data';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { logFiltersToSearchParams, readLogFilters } from '$lib/remote/admin/logs-data';

	import LogFilterPanel from './components/LogFilterPanel.svelte';
	import LogTable from './components/LogTable.svelte';

	let { data }: { data: PageData } = $props();

	// The URL is the single source of truth for filters and paging so views are shareable.
	const filters = $derived(readLogFilters(page.url.searchParams));
	const projectOptions = $derived([{ value: '', label: 'All Projects' }, ...data.projects]);

	function navigate(next: LogFilters) {
		goto(resolve(`/admin/logs?${logFiltersToSearchParams(next)}`));
	}
</script>

<svelte:head>
	<title>{m.nav_logs()}</title>
</svelte:head>

<div class="mx-auto max-w-7xl pt-16 px-4 sm:px-6 lg:px-8 overflow-y-auto h-screen pb-32">
	<h1 class="text-2xl font-bold mb-6 text-primary-500">{m.nav_logs()}</h1>

	<LogFilterPanel
		{filters}
		{projectOptions}
		onApply={(next) => navigate({ ...next, page: 1 })}
		onClear={() => goto(resolve('/admin/logs'))}
	/>

	<QueryBoundary>
		<LogTable {filters} onPageChange={(pageNumber) => navigate({ ...filters, page: pageNumber })} />
	</QueryBoundary>
</div>
