<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';

	/** @type {import('./$types').PageData} */
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
		{ value: 'frontend', label: 'Frontend' }
	];

	let filters = $state({
		level: data.filters.level || '',
		source: data.filters.source || '',
		search: data.filters.search || '',
		dateFrom: data.filters.dateFrom || '',
		dateTo: data.filters.dateTo || '',
		project: data.filters.project || ''
	});

	/**
	 * Apply filters
	 * @returns {void}
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
	 * Go to page
	 * @param {number} pageNum - Page number
	 * @returns {void}
	 */
	function goToPage(pageNum) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/admin/logs?${params.toString()}`);
	}

	/**
	 * Get log level color using Skeleton colors
	 * @param {string} level - Log level
	 * @returns {string} - Skeleton color class
	 */
	function getLevelColor(level) {
		const colors = {
			DEBUG: 'preset-filled-surface-500',
			INFO: 'preset-filled-primary-500',
			WARNING: 'preset-filled-warning-500',
			ERROR: 'preset-filled-error-500',
			CRITICAL: 'preset-filled-error-600'
		};
		return colors[level] || colors.INFO;
	}

	/**
	 * Get source color using Skeleton colors
	 * @param {string} source - Source
	 * @returns {string} - Skeleton color class
	 */
	function getSourceColor(source) {
		const colors = {
			backend: 'preset-filled-tertiary-500',
			frontend: 'preset-filled-warning-500'
		};
		return colors[source] || colors.backend;
	}

	/**
	 * Format timestamp
	 * @param {string} timestamp - Timestamp
	 * @returns {string} - Formatted timestamp
	 */
	function formatTimestamp(timestamp) {
		const date = new Date(timestamp);
		return date.toLocaleString();
	}

	const currentPage = $derived(Number(data.filters.page) || 1);
	const pageSize = 10;
	const totalPages = $derived(Math.ceil(data.count / pageSize));
</script>

<svelte:head>
	<title>System Logs</title>
</svelte:head>

<div class="mx-auto max-w-7xl pt-16 px-4 sm:px-6 lg:px-8 overflow-y-auto h-screen pb-32">
	<h1 class="text-2xl font-bold mb-6">System Logs</h1>

	<!-- Filters -->
	<div class="preset-filled-surface-50-950 rounded-lg shadow p-4 mb-6">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<!-- Log Level Filter -->
			<div>
				<label for="level" class="block text-sm font-medium mb-1">Level</label>
				<select id="level" bind:value={filters.level} class="select w-full">
					{#each logLevels as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Source Filter -->
			<div>
				<label for="source" class="block text-sm font-medium mb-1">Source</label>
				<select id="source" bind:value={filters.source} class="select w-full">
					{#each sources as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Project Filter -->
			<div>
				<label for="project" class="block text-sm font-medium mb-1">Project</label>
				<select id="project" bind:value={filters.project} class="select w-full">
					<option value="">All Projects</option>
					{#each data.projects || [] as project (project.id)}
						<option value={project.id}>{project.project}</option>
					{/each}
				</select>
			</div>

			<!-- Search -->
			<div>
				<label for="search" class="block text-sm font-medium mb-1">Search</label>
				<input
					id="search"
					type="text"
					bind:value={filters.search}
					placeholder="Search message..."
					class="input w-full"
				/>
			</div>

			<!-- Date From -->
			<div>
				<label for="dateFrom" class="block text-sm font-medium mb-1">From Date</label>
				<input
					id="dateFrom"
					type="datetime-local"
					bind:value={filters.dateFrom}
					class="input w-full"
				/>
			</div>

			<!-- Date To -->
			<div>
				<label for="dateTo" class="block text-sm font-medium mb-1">To Date</label>
				<input id="dateTo" type="datetime-local" bind:value={filters.dateTo} class="input w-full" />
			</div>
		</div>

		<!-- Filter Actions -->
		<div class="mt-4 flex gap-2">
			<button onclick={applyFilters} class="btn preset-filled-primary-500"> Apply Filters </button>
			<button onclick={() => goto('/admin/logs')} class="btn preset-filled-surface-500">
				Clear Filters
			</button>
		</div>
	</div>

	<!-- Results Count -->
	<div class="mb-4 text-sm text-surface-600-300">
		Showing {data.logs.length} of {data.count} log entries
	</div>

	<!-- Logs Table -->
	<div class="preset-filled-surface-50-950 rounded-lg shadow overflow-hidden">
		<div class="overflow-x-auto">
			<div class="table-wrap">
				<table class="table caption-bottom w-full">
					<thead>
						<tr>
							<th class="text-left">Timestamp</th>
							<th class="text-left">Level</th>
							<th class="text-left">Source</th>
							<th class="text-left">Project</th>
							<th class="text-left">User</th>
							<th class="text-left">Message</th>
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
								<td class="py-3 px-4 max-w-2xl break-words whitespace-normal" title={log.message}>
									{log.message}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="6" class="px-4 py-8 text-center text-surface-500-500">
									No log entries found
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
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
