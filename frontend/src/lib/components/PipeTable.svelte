<script>
	// Skeleton
	import { Pagination, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let { projectId, rowData = $bindable(), rowClickedSignal = $bindable(false) } = $props();

	let pipes = $state([]);
	let pipesError = $state(null);
	let loading = $state(false);
	let page = $state(1);
	let size = $state(100);
	let count = $derived(size);
	let deletingIds = $state(new Set());
	const slicedSource = $derived(pipes.slice((page - 1) * size, page * size));
	let headers = [
		m.name(),
		m.conduit_type(),
		m.outer_conduit(),
		m.status(),
		m.network_level(),
		m.owner(),
		m.constructor(),
		m.manufacturer(),
		m.date(),
		m.flag()
	];

	async function fetchPipes() {
		if (!projectId) {
			return;
		}

		loading = true;
		pipesError = null;

		try {
			let url = `${PUBLIC_API_URL}conduit/all/?project=${projectId}`;
			let response = await fetch(url, { credentials: 'include' });

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			pipes = data.map((item) => ({
				value: item.uuid,
				name: item.name,
				conduit_type: item.conduit_type.conduit_type,
				outer_conduit: item.outer_conduit,
				status: item.status ? item.status.status : '',
				network_level: item.network_level ? item.network_level.network_level : '',
				owner: item.owner ? item.owner.company : '',
				constructor: item.constructor ? item.constructor.company : '',
				manufacturer: item.manufacturer ? item.manufacturer.company : '',
				date: item.date,
				flag: item.flag.flag
			}));
		} catch (error) {
			toaster.create({
				type: 'error',
				title: m.error_fetching_pipes(),
				description: m.error_fetching_pipes_description()
			});
		} finally {
			loading = false;
		}
	}

	function handleRowClick(pipe) {
		rowData = pipe;
		rowClickedSignal = true;
	}

	$effect(() => {
		if (projectId) {
			fetchPipes();
		}
	});
</script>

<div class="table-wrap overflow-x-auto">
	<table class="table table-card caption-bottom w-full">
		<thead>
			<tr>
				{#each headers as header}
					<th
						><a href={`#${header}`} class="group inline-flex">
							{header}
							<span
								class="invisible ml-2 flex-none rounded-sm text-gray-400 group-hover:visible group-focus:visible"
							>
								<svg
									class="size-5"
									viewBox="0 0 20 20"
									fill="currentColor"
									aria-hidden="true"
									data-slot="icon"
								>
									<path
										fill-rule="evenodd"
										d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
										clip-rule="evenodd"
									/>
								</svg>
							</span>
						</a></th
					>
				{/each}
			</tr>
		</thead>
		<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
			{#if loading}
				{#each { length: size } as _}
					<tr>
						{#each { length: 10 } as _}
							<td>
								<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
							</td>
						{/each}
					</tr>
				{/each}
			{:else}
				{#each slicedSource as row}
					<tr onclick={() => handleRowClick(row)}>
						<td data-label={m.name()}>{row.name}</td>
						<td data-label={m.conduit_type()}>{row.conduit_type}</td>
						<td data-label={m.outer_conduit()}>{row.outer_conduit}</td>
						<td data-label={m.status()}>{row.status}</td>
						<td data-label={m.network_level()}>{row.network_level}</td>
						<td data-label={m.owner()}>{row.owner}</td>
						<td data-label={m.constructor()}>{row.constructor}</td>
						<td data-label={m.manufacturer()}>{row.manufacturer}</td>
						<td data-label={m.date()}>{row.date}</td>
						<td data-label={m.flag()}>{row.flag}</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
<Pagination
	data={pipes}
	{page}
	onPageChange={(e) => (page = e.page)}
	pageSize={size}
	onPageSizeChange={(e) => (size = e.pageSize)}
	siblingCount={4}
	alternative
/>
