<script lang="ts">
	import type { LogFilters } from '$lib/remote/admin/logs-data';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { LOG_PAGE_SIZE } from '$lib/remote/admin/logs-data';
	import { getLogs } from '$lib/remote/admin/logs.remote';

	let { filters, onPageChange }: { filters: LogFilters; onPageChange: (page: number) => void } =
		$props();

	const logPage = $derived(await getLogs(filters));
	const totalPages = $derived(Math.ceil(logPage.count / LOG_PAGE_SIZE));

	const LEVEL_CLASSES: Record<string, string> = {
		DEBUG: 'preset-filled-surface-500',
		INFO: 'preset-filled-primary-500',
		WARNING: 'preset-filled-warning-500',
		ERROR: 'preset-filled-error-500',
		CRITICAL: 'preset-filled-error-600'
	};

	const SOURCE_CLASSES: Record<string, string> = {
		backend: 'preset-filled-tertiary-500',
		frontend: 'preset-filled-warning-500',
		wfs: 'preset-filled-error-500'
	};

	/**
	 * Maps a log level to its Skeleton preset class.
	 * @param level - Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
	 */
	function levelClass(level: string) {
		return LEVEL_CLASSES[level] ?? LEVEL_CLASSES.INFO;
	}

	/**
	 * Maps a log source to its Skeleton preset class.
	 * @param source - Log source (backend, frontend, wfs).
	 */
	function sourceClass(source: string | undefined) {
		return (source && SOURCE_CLASSES[source]) || SOURCE_CLASSES.backend;
	}

	/**
	 * Formats an ISO timestamp into a locale-appropriate date/time string.
	 * @param timestamp - ISO 8601 timestamp.
	 */
	function formatTimestamp(timestamp: string) {
		return new Date(timestamp).toLocaleString();
	}
</script>

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
					{#each logPage.results as log (log.uuid)}
						<tr class="hover:preset-tonal-primary">
							<td class="py-3 px-4 whitespace-nowrap">
								{formatTimestamp(log.timestamp)}
							</td>
							<td class="py-3 px-4">
								<span class="badge {levelClass(log.level)}">
									{log.level}
								</span>
							</td>
							<td class="py-3 px-4">
								<span class="badge {sourceClass(log.source)}">
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
	{#each logPage.results as log (log.uuid)}
		<div class="preset-filled-surface-50-950 rounded-lg shadow p-4">
			<div class="flex items-center justify-between mb-2">
				<span class="badge {levelClass(log.level)}">{log.level}</span>
				<span class="badge {sourceClass(log.source)}">{log.source}</span>
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

{#if totalPages > 1}
	<div class="mt-6 flex justify-center">
		<Pagination
			count={logPage.count}
			pageSize={LOG_PAGE_SIZE}
			page={filters.page}
			onPageChange={(event) => onPageChange(event.page)}
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
							<Pagination.Ellipsis {index}>…</Pagination.Ellipsis>
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
