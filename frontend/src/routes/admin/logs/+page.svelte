<script lang="ts">
	import type { PageData } from './$types';
	import type { LogFilters } from '$lib/remote/admin/logs-data';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { setQuery } from '$lib/utils/urlState';
	import {
		DEFAULT_LOG_FILTERS,
		logFiltersToQuery,
		readLogFilters
	} from '$lib/remote/admin/logs-data';

	import LogFilterPanel from './components/LogFilterPanel.svelte';
	import LogTable from './components/LogTable.svelte';

	let { data }: { data: PageData } = $props();

	// The URL is the single source of truth for filters and paging so views are shareable.
	const filters = $derived(readLogFilters(page.url));
	const projectOptions = $derived([{ value: '', label: 'All Projects' }, ...data.projects]);

	/**
	 * Writes the filters to the URL; filters and paging are adjustments, so
	 * they replace the current history entry.
	 * @param next - The filters to show.
	 */
	function navigate(next: LogFilters) {
		setQuery(logFiltersToQuery(next));
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
		onClear={() => navigate(DEFAULT_LOG_FILTERS)}
	/>

	<QueryBoundary>
		<LogTable {filters} onPageChange={(pageNumber) => navigate({ ...filters, page: pageNumber })} />
	</QueryBoundary>
</div>
