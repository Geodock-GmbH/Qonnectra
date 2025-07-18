<script>
	// Skeleton
	import { FileUpload, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconUpload, IconPlus } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import PipeTable from '$lib/components/PipeTable.svelte';
	import PipeModal from '$lib/components/PipeModal.svelte';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { selectedProject, selectedFlag } from '$lib/stores/store';
	import { navigating, page } from '$app/stores';
	import { goto } from '$app/navigation';

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

	$effect(() => {
		const projectId = $selectedProject;
		const currentPath = $page.url.pathname;
		if (projectId) {
			let targetPath = `/conduit/${projectId}`;
			const currentSearch = $page.url.search;

			if (currentPath !== targetPath) {
				goto(targetPath + currentSearch, {
					keepFocus: true,
					noScroll: true,
					replaceState: true
				});
			}
		}
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
			type: 'loading',
			title: 'Importing conduits...',
			description: 'Please wait while we process your file.'
		});

		try {
			const response = await fetch('/conduit/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			console.log('result', result);

			if (response.ok) {
				toaster.create({
					type: 'success',
					title: 'Import Successful',
					description:
						result.message || `Successfully imported ${result.created_count || 0} conduits.`,
					timeout: 5000
				});
			} else {
				let errorMessage = 'An unknown error occurred.';
				if (result.errors && Array.isArray(result.errors)) {
					errorMessage = result.errors.join('\n');
				} else if (result.error) {
					errorMessage = result.error;
				}

				toaster.create({
					type: 'error',
					title: 'Import Failed',
					description: errorMessage,
					timeout: 10000
				});
			}
		} catch (error) {
			// Close loading toast
			toaster.close(loadingToast);

			toaster.create({
				type: 'error',
				title: 'Import Error',
				description: 'An error occurred during import. Please try again.',
				timeout: 5000
			});
			console.error('Import error:', error);
		}
	}

	function handleFileReject(event) {
		const rejectedFiles = event.detail.rejectedFiles;
		if (rejectedFiles && rejectedFiles.length > 0) {
			const errors = rejectedFiles.map((file) => `${file.file.name}: ${file.errors.join(', ')}`);
			toaster.create({
				type: 'error',
				title: 'File Rejected',
				description: errors.join('\n'),
				timeout: 5000
			});
		}
	}
</script>

<Toaster {toaster} />

<div class="flex justify-between items-center">
	<div class="flex justify-start">
		<nav class="btn-group preset-outlined-surface-200-800 flex-col justify-between p-2 md:flex-row">
			<PipeModal
				projectId={$selectedProject}
				{openPipeModal}
				pipeData={rowData}
				bind:rowClickedSignal
				onPipeUpdate={handlePipeUpdate}
			/>
			<SearchInput bind:value={searchInput} onSearch={performSearch} />
		</nav>
	</div>

	<div class="flex justify-end">
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
					<span>{m.import_conduit_xlsx()}</span>
				</button>
			</FileUpload>
			<a href="/conduit/download" download class="btn preset-filled-primary-500">
				{m.download_template()}
			</a>
		</nav>
	</div>
</div>

<svelte:head>
	<title>{m.conduit_management()}</title>
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
