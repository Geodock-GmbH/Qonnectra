<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { setQuery } from '$lib/utils/urlState';

	interface Props {
		/** Total number of rows across all pages, as reported by the server. */
		totalCount: number;
		/** Rows per page. */
		pageSize: number;
		/** The 1-based page currently shown; changing it writes `?page=` to the URL. */
		page: number;
	}

	let { totalCount, pageSize, page }: Props = $props();

	/** Phone widths only fit first/last page plus the current one without overflowing. */
	const mobile = new MediaQuery('max-width: 767px', false);
</script>

<div class="flex flex-col items-center gap-2 md:flex-row md:justify-between md:gap-4">
	<span class="text-sm text-surface-600-400" data-testid="pagination-count">
		{totalCount}
		{m.common_results({ count: totalCount })}
	</span>
	<Pagination
		count={totalCount}
		{pageSize}
		{page}
		siblingCount={mobile.current ? 0 : 1}
		onPageChange={(e) => setQuery({ page: e.page })}
		class="max-w-full gap-1 md:gap-2"
	>
		<Pagination.PrevTrigger>
			<IconArrowLeft class="size-4" />
		</Pagination.PrevTrigger>
		<Pagination.Context>
			{#snippet children(paginationCtx)}
				{#each paginationCtx().pages as pageItem, index (pageItem)}
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
