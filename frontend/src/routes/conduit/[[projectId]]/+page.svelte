<script>
	import { setContext } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';
	import { IconDownload, IconUpload, IconLoader2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { ConduitState } from '$lib/classes/ConduitState.svelte.js';
	import Drawer from '$lib/components/Drawer.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import PipeModal from './PipeModal.svelte';
	import PipeTable from './PipeTable.svelte';

	let { data } = $props();
	let searchInput = $state(data.searchTerm || '');
	let openPipeModal = $state(false);
	let isUploading = $state(false);
	let uploadFormRef = $state(null);

	// Initialize state manager
	const conduitState = new ConduitState(data);

	// Update conduits when data changes (e.g., after search)
	$effect(() => {
		conduitState.setConduits(data.pipes);
	});

	// Set context for attribute options (eliminates prop drilling)
	setContext('attributeOptions', {
		conduitTypes: data.conduitTypes,
		statuses: data.statuses,
		networkLevels: data.networkLevels,
		companies: data.companies,
		flags: data.flags
	});

	// Set context for conduit state (for form defaults persistence)
	setContext('conduitState', conduitState);

	function performSearch() {
		const url = new URL($page.url);
		if (searchInput !== '') {
			url.searchParams.set('search', searchInput);
		} else {
			url.searchParams.delete('search');
		}
		goto(url, { keepFocus: true, noScroll: true, replaceState: true });
	}

	// Handler for conduit update from drawer
	function handleConduitUpdate(updatedConduit) {
		conduitState.updateConduit(updatedConduit);
	}

	// Handler for conduit delete from drawer
	function handleConduitDelete(conduitId) {
		conduitState.deleteConduit(conduitId);
	}

	// Handler for new conduit from modal
	function handleConduitCreate(newConduit) {
		if (newConduit) {
			conduitState.addConduit(newConduit);
		}
	}

	/**
	 * Handle file selection - auto-submit the form when a file is selected
	 */
	function handleFileSelect(files) {
		if (files.length > 0 && uploadFormRef) {
			uploadFormRef.requestSubmit();
		}
	}

	/**
	 * Enhance callback for upload form - handles success/failure responses
	 */
	function handleUploadSubmit() {
		return async ({ result }) => {
			isUploading = false;

			if (result.type === 'success' && result.data?.uploadSuccess) {
				// Show warnings if present
				if (result.data.warnings?.length > 0) {
					globalToaster.warning({
						title: m.common_warning(),
						description: result.data.warnings.join('\n')
					});
				}

				globalToaster.success({
					title: m.title_import_conduits_success(),
					description:
						result.data.message ||
						m.message_import_conduits_success_description({ count: result.data.createdCount || 0 })
				});

				// Refresh data without full page reload
				await invalidate('app:conduits');
			} else if (result.type === 'failure') {
				const data = result.data;
				let errorMessage = m.message_please_try_again();

				if (data?.errors?.length > 0) {
					errorMessage = data.errors.join('\n');
				} else if (data?.message) {
					errorMessage = data.message;
				}

				// Show warnings if present
				if (data?.warnings?.length > 0) {
					globalToaster.warning({
						title: m.common_warning(),
						description: data.warnings.join('\n')
					});
				}

				globalToaster.error({
					title: m.title_import_conduits_error(),
					description: errorMessage
				});
			} else if (result.type === 'error') {
				globalToaster.error({
					title: m.title_import_conduits_error(),
					description: m.message_please_try_again()
				});
			}
		};
	}

	async function downloadTemplate() {
		const response = await fetch('/conduit/download');
		const blob = await response.blob();
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'conduit_import_template.xlsx';
		a.click();
		window.URL.revokeObjectURL(url);

		globalToaster.success({
			title: m.title_success(),
			description: m.message_success_downloading_template()
		});
	}
</script>

<svelte:head>
	<title>{m.nav_conduit_management()}</title>
</svelte:head>

<div class="relative flex gap-4 h-full overflow-hidden">
	<div class="flex-1 flex flex-col overflow-hidden h-full border-2 rounded-lg border-surface-200-800 p-4">
		<div class="flex justify-between items-center">
			<div class="flex items-center">
				<nav
					class="btn-group md:preset-outlined-surface-200-800 flex-col justify-between items-start md:flex-row"
				>
					<PipeModal
						projectId={$selectedProject}
						bind:openPipeModal
						onPipeCreate={handleConduitCreate}
					/>
					<SearchInput bind:value={searchInput} onSearch={performSearch} />
				</nav>
			</div>

			<div class="hidden md:flex justify-end">
				<nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row">
					<form
						method="POST"
						action="?/uploadConduits"
						enctype="multipart/form-data"
						bind:this={uploadFormRef}
						use:enhance={() => {
							isUploading = true;
							return handleUploadSubmit();
						}}
					>
						<FileUpload
							accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							maxFiles={1}
							name="file"
							disabled={isUploading}
							onFileChange={(details) => {
								if (details.acceptedFiles.length > 0) {
									handleFileSelect(details.acceptedFiles);
								}
							}}
						>
							<FileUpload.Trigger class="btn preset-filled-primary-500" disabled={isUploading}>
								{#if isUploading}
									<IconLoader2 class="size-4 animate-spin" />
								{:else}
									<IconUpload class="size-4" />
								{/if}
								<span>{isUploading ? m.common_loading() : m.action_import_conduit_xlsx()}</span>
							</FileUpload.Trigger>
							<FileUpload.HiddenInput />
						</FileUpload>
					</form>
					<button onclick={downloadTemplate} class="btn preset-filled-primary-500">
						<IconDownload class="size-4" />
						<span>{m.form_template()}</span>
					</button>
				</nav>
			</div>
		</div>

		<div class="flex-1 min-h-0">
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
				<PipeTable
					pipes={conduitState.conduits}
					onConduitUpdate={handleConduitUpdate}
					onConduitDelete={handleConduitDelete}
				/>
			{/if}
		</div>
	</div>

	<Drawer />
</div>
