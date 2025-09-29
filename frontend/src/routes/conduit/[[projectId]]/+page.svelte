<script>
	// Skeleton
	import { FileUpload, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconUpload } from '@tabler/icons-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { selectedProject } from '$lib/stores/store';
	import PipeModal from './PipeModal.svelte';
	import PipeTable from './PipeTable.svelte';

	let openPipeModal = $state(false);
	let rowData = $state(null);
	let rowClickedSignal = $state(false);
	let { data } = $props();
	let searchInput = $state(data.searchTerm || '');
	let searchTerm = $state('');
	let updatedPipeData = $state(null);

	// Toast
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	function performSearch() {
		const url = new URL($page.url);
		if (searchInput !== '') {
			url.searchParams.set('search', searchInput);
		} else {
			url.searchParams.delete('search');
		}
		goto(url, { keepFocus: true, noScroll: true, replaceState: true });
	}

	function handlePipeUpdate(data) {
		// Add a timestamp to ensure uniqueness
		updatedPipeData = {
			...data,
			_updateId: Date.now()
		};
	}

	async function handleFileAccept(event) {
		const file = event.files[0];
		if (!file) {
			return;
		}

		const formData = new FormData();
		formData.append('file', file);

		// Show loading toast
		const loadingToast = toaster.create({
			type: 'info',
			title: m.common_import(),
			description: m.message_importing_conduits_description()
		});

		try {
			const response = await fetch('/conduit/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok) {
				toaster.success({
					title: m.title_import_conduits_success(),
					description:
						result.message ||
						m.message_import_conduits_success_description(result.created_count || 0)
				});
				return;
			} else {
				let errorMessage = m.message_please_try_again();
				if (result.errors && Array.isArray(result.errors)) {
					errorMessage = result.errors.join('\n');
				} else if (result.error) {
					errorMessage = result.error;
				}

				toaster.error({
					title: m.title_import_conduits_error(),
					description: errorMessage
				});

				return;
			}
		} catch (error) {
			toaster.error({
				title: m.title_import_conduits_error(),
				description: m.message_please_try_again()
			});
			console.error('Import error:', error);
		}
	}

	function handleFileReject(event) {
		const rejectedFiles = event.detail.rejectedFiles;
		if (rejectedFiles && rejectedFiles.length > 0) {
			const errors = rejectedFiles.map((file) => `${file.file.name}: ${file.errors.join(', ')}`);
			toaster.error({
				title: m.title_file_rejected(),
				description: m.message_file_rejected_description() + '\n' + errors.join('\n')
			});
		}
	}
</script>

<Toaster {toaster} />

<div class="flex justify-between items-center">
	<div class="flex items-center">
		<nav
			class="btn-group md:preset-outlined-surface-200-800 flex-col justify-between items-start md:flex-row"
		>
			<PipeModal
				projectId={$selectedProject}
				{openPipeModal}
				pipeData={rowData}
				bind:rowClickedSignal
				onPipeUpdate={handlePipeUpdate}
				conduitTypes={data.conduitTypes}
				statuses={data.statuses}
				networkLevels={data.networkLevels}
				companies={data.companies}
				flags={data.flags}
			/>
			<SearchInput bind:value={searchInput} onSearch={performSearch} />
		</nav>
	</div>

	<div class="hidden md:flex justify-end">
		<nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row">
			<FileUpload
				accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				maxFiles={1}
				name="conduit-import"
				maxFileSize={1024 * 1024 * 10}
				onFileAccept={handleFileAccept}
				onFileReject={handleFileReject}
			>
				<button name="import-conduit" class="btn preset-filled-primary-500">
					<IconUpload class="size-4" />
					<span>{m.action_import_conduit_xlsx()}</span>
				</button>
			</FileUpload>
			<a href="/conduit/download" download class="btn preset-filled-primary-500">
				{m.action_download_template()}
			</a>
		</nav>
	</div>
</div>

<svelte:head>
	<title>{m.nav_conduit_management()}</title>
</svelte:head>

{#if $navigating}
	<div class="table-wrap overflow-x-auto">
		<table class="table table-card caption-bottom w-full overflow-scroll">
			<thead>
				<tr>
					{#each { length: 10 } as _}
						<td>
							<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
						</td>
					{/each}
				</tr>
			</thead>
		</table>
	</div>
{:else}
	<PipeTable pipes={data.pipes} bind:rowData bind:rowClickedSignal {updatedPipeData} />
{/if}
