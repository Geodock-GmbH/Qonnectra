<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	let { data } = $props();

	const logLevels = [
		{ value: '', label: 'All Levels' },
		{ value: 'DEBUG', label: 'Debug' },
		{ value: 'INFO', label: 'Info' },
		{ value: 'WARNING', label: 'Warning' },
		{ value: 'ERROR', label: 'Error' },
		{ value: 'CRITICAL', label: 'Critical' }
	];

	const sources = [
		{ value: '', label: 'All Sources' },
		{ value: 'backend', label: 'Backend' },
		{ value: 'frontend', label: 'Frontend' },
		{ value: 'wfs', label: 'WFS (QGIS Server)' }
	];

	// svelte-ignore state_referenced_locally
	let filters = $state({
		level: data.filters.level || '',
		source: data.filters.source || '',
		search: data.filters.search || '',
		dateFrom: data.filters.dateFrom || '',
		dateTo: data.filters.dateTo || '',
		project: data.filters.project || ''
	});

	/**
	 * Navigates to page 1 with all active filter values as query parameters.
	 */
	function applyFilters() {
		const params = new URLSearchParams();
		if (filters.level) params.set('level', filters.level);
		if (filters.source) params.set('source', filters.source);
		if (filters.search) params.set('search', filters.search);
		if (filters.dateFrom) params.set('date_from', filters.dateFrom);
		if (filters.dateTo) params.set('date_to', filters.dateTo);
		if (filters.project) params.set('project', filters.project);
		params.set('page', '1');
		goto(`/admin/logs?${params.toString()}`);
	}

	/**
	 * Navigates to a specific log page while preserving current filters.
	 * @param {number} pageNum - The target page number.
	 */
	function goToPage(pageNum) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/admin/logs?${params.toString()}`);
	}

	/**
	 * Maps a log level to its corresponding Skeleton preset class.
	 * @param {string} level - Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
	 * @returns {string} Skeleton color preset class.
	 */
	function getLevelColor(level) {
		const colors = {
			DEBUG: 'preset-filled-surface-500',
			INFO: 'preset-filled-primary-500',
			WARNING: 'preset-filled-warning-500',
			ERROR: 'preset-filled-error-500',
			CRITICAL: 'preset-filled-error-600'
		};
		return /** @type {Record<string, string>} */ (colors)[level] || colors.INFO;
	}

	/**
	 * Maps a log source to its corresponding Skeleton preset class.
	 * @param {string} source - Log source (backend, frontend, wfs).
	 * @returns {string} Skeleton color preset class.
	 */
	function getSourceColor(source) {
		const colors = {
			backend: 'preset-filled-tertiary-500',
			frontend: 'preset-filled-warning-500',
			wfs: 'preset-filled-error-500'
		};
		return /** @type {Record<string, string>} */ (colors)[source] || colors.backend;
	}

	/**
	 * Formats an ISO timestamp into a locale-appropriate date/time string.
	 * @param {string} timestamp - ISO 8601 timestamp.
	 * @returns {string} Formatted date/time string.
	 */
	function formatTimestamp(timestamp) {
		const date = new Date(timestamp);
		return date.toLocaleString();
	}

	const projectOptions = $derived([
		{ value: '', label: 'All Projects' },
		...(data.projects || []).map((/** @type {{ id: number, project: string }} */ p) => ({
			value: String(p.id),
			label: p.project
		}))
	]);

	const currentPage = $derived(Number(data.filters.page) || 1);
	const pageSize = 10;
	const totalPages = $derived(Math.ceil(data.count / pageSize));
</script>

<svelte:head>
	<title>{m.nav_logs()}</title>
</svelte:head>

<div class="mx-auto max-w-7xl pt-16 px-4 sm:px-6 lg:px-8 overflow-y-auto h-screen pb-32">
	<h1 class="text-2xl font-bold mb-6 text-primary-500">{m.nav_logs()}</h1>

	<!-- Filters -->
	<div class="preset-filled-surface-50-950 rounded-lg shadow p-4 mb-6">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<div>
				<span class="block text-sm font-medium mb-1">{m.form_level()}</span>
				<GenericCombobox
					data={logLevels}
					value={[filters.level]}
					onValueChange={(/** @type {{ value: string[] }} */ e) => {
						filters.level = e.value[0] || '';
					}}
				/>
			</div>

			<div>
				<span class="block text-sm font-medium mb-1">{m.form_source()}</span>
				<GenericCombobox
					data={sources}
					value={[filters.source]}
					onValueChange={(/** @type {{ value: string[] }} */ e) => {
						filters.source = e.value[0] || '';
					}}
				/>
			</div>

			<div>
				<span class="block text-sm font-medium mb-1">{m.form_project({ count: 1 })}</span>
				<GenericCombobox
					data={projectOptions}
					value={[String(filters.project)]}
					onValueChange={(/** @type {{ value: string[] }} */ e) => {
						filters.project = e.value[0] || '';
					}}
				/>
			</div>

			<div>
				<label for="search" class="block text-sm font-medium mb-1">{m.common_search()}</label>
				<input
					id="search"
					type="text"
					bind:value={filters.search}
					placeholder={m.common_searching()}
					class="input w-full"
				/>
			</div>

			<div>
				<label for="dateFrom" class="block text-sm font-medium mb-1">{m.form_date_from()}</label>
				<input
					id="dateFrom"
					type="datetime-local"
					bind:value={filters.dateFrom}
					class="input w-full"
				/>
			</div>

			<div>
				<label for="dateTo" class="block text-sm font-medium mb-1">{m.form_date_to()}</label>
				<input id="dateTo" type="datetime-local" bind:value={filters.dateTo} class="input w-full" />
			</div>
		</div>

		<div class="mt-4 flex flex-col sm:flex-row gap-2">
			<button onclick={applyFilters} class="btn preset-filled-primary-500">
				{m.action_apply_filters()}
			</button>
			<button onclick={() => goto('/admin/logs')} class="btn preset-filled-surface-500">
				{m.action_clear_filters()}
			</button>
		</div>
	</div>

	<!-- Logs Table (desktop) -->
	<div class="preset-filled-surface-50-950 rounded-lg shadow overflow-hidden hidden md:block">
		<div class="overflow-x-auto">
			<div class="table-wrap">
				<table class="table caption-bottom w-full">
					<thead>
						<tr>
							<th class="text-left">{m.form_timestamp()}</th>
							<th class="text-left">{m.form_level()}</th>
							<th class="text-left">{m.form_source()}</th>
							<th class="text-left">{m.form_project({ count: 1 })}</th>
							<th class="text-left">{m.auth_username()}</th>
							<th class="text-left">{m.form_message()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.logs as log (log.uuid || log.timestamp)}
							<tr class="hover:preset-tonal-primary">
								<td class="py-3 px-4 whitespace-nowrap">
									{formatTimestamp(log.timestamp)}
								</td>
								<td class="py-3 px-4">
									<span class="badge {getLevelColor(log.level)}">
										{log.level}
									</span>
								</td>
								<td class="py-3 px-4">
									<span class="badge {getSourceColor(log.source)}">
										{log.source}
									</span>
								</td>
								<td class="py-3 px-4">
									{#if log.project}
										<span class="badge preset-filled-tertiary-500">
											{log.project.project}
										</span>
									{:else}
										<span class="text-surface-500-500">-</span>
									{/if}
								</td>
								<td class="py-3 px-4">{log.username || '-'}</td>
								<td
									class="py-3 px-4 max-w-2xl wrap-break-words whitespace-normal break-all"
									title={log.message}
								>
									{log.message}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="6" class="px-4 py-8 text-center text-surface-500-500">
									{m.message_no_logs_found()}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- Logs Cards (mobile) -->
	<div class="flex flex-col gap-3 md:hidden">
		{#each data.logs as log (log.uuid || log.timestamp)}
			<div class="preset-filled-surface-50-950 rounded-lg shadow p-4">
				<div class="flex items-center justify-between mb-2">
					<span class="badge {getLevelColor(log.level)}">{log.level}</span>
					<span class="badge {getSourceColor(log.source)}">{log.source}</span>
				</div>
				<p class="text-sm text-surface-500-500 mb-1">{formatTimestamp(log.timestamp)}</p>
				<div class="flex items-center gap-2 mb-2">
					{#if log.project}
						<span class="badge preset-filled-tertiary-500 text-xs">{log.project.project}</span>
					{/if}
					{#if log.username}
						<span class="text-xs text-surface-500-500">{log.username}</span>
					{/if}
				</div>
				<p class="text-sm wrap-break-word">{log.message}</p>
			</div>
		{:else}
			<div
				class="preset-filled-surface-50-950 rounded-lg shadow p-8 text-center text-surface-500-500"
			>
				{m.message_no_logs_found()}
			</div>
		{/each}
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="mt-6 flex justify-center">
			<Pagination
				count={data.count}
				{pageSize}
				page={currentPage}
				onPageChange={(event) => goToPage(event.page)}
			>
				<Pagination.PrevTrigger>
					<IconArrowLeft class="size-4" />
				</Pagination.PrevTrigger>
				<Pagination.Context>
					{#snippet children(pagination)}
						{#each pagination().pages as pageItem, index (pageItem)}
							{#if pageItem.type === 'page'}
								<Pagination.Item {...pageItem}>
									{pageItem.value}
								</Pagination.Item>
							{:else}
								<Pagination.Ellipsis {index}>&#8230;</Pagination.Ellipsis>
							{/if}
						{/each}
					{/snippet}
				</Pagination.Context>
				<Pagination.NextTrigger>
					<IconArrowRight class="size-4" />
				</Pagination.NextTrigger>
			</Pagination>
		</div>
	{/if}
</div>
