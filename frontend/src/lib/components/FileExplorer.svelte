<script>
	import { SvelteMap } from 'svelte/reactivity';
	import { createTreeViewCollection, TreeView } from '@skeletonlabs/skeleton-svelte';
	import { IconDownload, IconEdit, IconFile, IconFolder, IconTrash } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	/**
	 * @typedef {Object} FileExplorerProps
	 * @property {string} featureType - The type of feature (e.g., 'cable', 'node', 'trench')
	 * @property {string} featureId - The UUID of the feature
	 */

	/** @type {FileExplorerProps} */
	let { featureType, featureId } = $props();

	let files = $state([]);
	let isLoading = $state(false);
	let error = $state(null);
	let editingFile = $state(null);
	let editValue = $state('');
	let deletingFile = $state(null);

	/**
	 * Transform flat file list into tree structure
	 * Files are grouped by category (photos, documents, etc.)
	 */
	function buildTreeFromFiles(fileList) {
		const categoryMap = new SvelteMap();

		// Group files by category
		for (const file of fileList) {
			// Extract category from file path (e.g., "trenches/123/photos/image.jpg" -> "photos")
			const pathParts = file.file_path.split('/');
			const category = pathParts.length >= 3 ? pathParts[pathParts.length - 2] : 'uncategorized';

			if (!categoryMap.has(category)) {
				categoryMap.set(category, []);
			}
			categoryMap.get(category).push(file);
		}

		// Build tree structure
		const children = [];
		for (const [category, categoryFiles] of categoryMap.entries()) {
			children.push({
				id: `category-${category}`,
				name: `${category} (${categoryFiles.length})`,
				type: 'category',
				children: categoryFiles.map((file) => ({
					id: file.uuid,
					name: file.file_name + (file.file_type ? `.${file.file_type}` : ''),
					type: 'file',
					fileData: file
				}))
			});
		}

		return createTreeViewCollection({
			nodeToValue: (node) => node.id,
			nodeToString: (node) => node.name,
			rootNode: {
				id: 'root',
				name: '',
				children
			}
		});
	}

	const collection = $derived(buildTreeFromFiles(files));

	/**
	 * Load files from API
	 */
	async function loadFiles() {
		if (!featureId) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(`${PUBLIC_API_URL}feature-files/?object_id=${featureId}`, {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Failed to load files: ${response.status}`);
			}

			const data = await response.json();
			files = Array.isArray(data) ? data : data.results || [];
		} catch (err) {
			console.error('Error loading files:', err);
			error = err.message;
			globalToaster.error({
				title: m.common_error(),
				description: 'Failed to load files'
			});
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Handle file double-click to preview
	 */
	function handleFileDoubleClick(file) {
		const url = `${PUBLIC_API_URL}feature-files/${file.uuid}/preview/`;
		window.open(url, '_blank');
	}

	/**
	 * Download file (triggered by download button)
	 */
	function downloadFile(file) {
		const url = `${PUBLIC_API_URL}feature-files/${file.uuid}/download/`;
		window.open(url, '_blank');
	}

	/**
	 * Delete file
	 */
	async function deleteFile(file) {
		try {
			const response = await fetch(`${PUBLIC_API_URL}feature-files/${file.uuid}/`, {
				method: 'DELETE',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Failed to delete file: ${response.status}`);
			}

			globalToaster.success({
				title: m.title_success(),
				description: 'File deleted successfully'
			});

			// Reload files
			await loadFiles();
		} catch (err) {
			console.error('Error deleting file:', err);
			globalToaster.error({
				title: m.common_error(),
				description: 'Failed to delete file'
			});
		} finally {
			deletingFile = null;
		}
	}

	/**
	 * Start editing a file name
	 */
	function startEditing(file) {
		editingFile = file;
		editValue = file.file_name + (file.file_type ? `.${file.file_type}` : '');
	}

	/**
	 * Cancel editing
	 */
	function cancelEditing() {
		editingFile = null;
		editValue = '';
	}

	/**
	 * Save file rename
	 */
	async function saveRename(file) {
		if (!editValue.trim()) {
			globalToaster.warning({
				title: m.common_error(),
				description: 'File name cannot be empty'
			});
			return;
		}

		try {
			const response = await fetch(`${PUBLIC_API_URL}feature-files/${file.uuid}/rename/`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					new_filename: editValue
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `Failed to rename file: ${response.status}`);
			}

			globalToaster.success({
				title: m.title_success(),
				description: 'File renamed successfully'
			});

			// Reload files
			await loadFiles();
			cancelEditing();
		} catch (err) {
			console.error('Error renaming file:', err);
			globalToaster.error({
				title: m.common_error(),
				description: 'Failed to rename file'
			});
		}
	}

	/**
	 * Public method to refresh files (can be called by parent)
	 */
	export function refresh() {
		loadFiles();
	}

	// Load files when component mounts or featureId changes
	$effect(() => {
		if (featureId && featureType) {
			loadFiles();
		}
	});
</script>

<div class="flex flex-col gap-4 p-4">
	{#if isLoading}
		<div class="text-center py-8 text-surface-500">
			<p>Loading files...</p>
		</div>
	{:else if error}
		<div class="text-center py-8 text-error-500 space-y-2">
			<p>Error loading files: {error}</p>
			<button type="button" onclick={loadFiles} class="btn preset-filled-primary-500">
				Retry
			</button>
		</div>
	{:else if files.length === 0}
		<div class="text-center py-8 text-surface-500">
			<p>{m.form_no_files_uploaded_yet()}</p>
		</div>
	{:else}
		<TreeView {collection}>
			<TreeView.Label>{m.form_uploaded_files()}</TreeView.Label>
			<TreeView.Tree>
				{#each collection.rootNode.children || [] as node, index (node)}
					{@render treeNode(node, [index])}
				{/each}
			</TreeView.Tree>
		</TreeView>
	{/if}
</div>

<!-- Confirmation Dialog for Delete -->
{#if deletingFile}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		role="button"
		tabindex="0"
		onclick={() => (deletingFile = null)}
		onkeydown={(e) => {
			if (e.key === 'Escape') deletingFile = null;
		}}
	>
		<div
			class="bg-surface-100 dark:bg-surface-800 rounded-lg p-6 max-w-md"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h3 class="text-lg font-semibold mb-4">Confirm Delete</h3>
			<p class="mb-6">
				Are you sure you want to delete <strong
					>{deletingFile.file_name}.{deletingFile.file_type}</strong
				>? This action cannot be undone.
			</p>
			<div class="flex gap-2 justify-end">
				<button type="button" onclick={() => (deletingFile = null)} class="btn preset-tonal">
					Cancel
				</button>
				<button
					type="button"
					onclick={() => deleteFile(deletingFile)}
					class="btn preset-filled-error-500"
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

{#snippet treeNode(node, indexPath)}
	<TreeView.NodeProvider value={{ node, indexPath }}>
		{#if node.type === 'category'}
			<TreeView.Branch>
				<TreeView.BranchControl>
					<TreeView.BranchIndicator />
					<TreeView.BranchText>
						<IconFolder class="size-4" />
						{node.name}
					</TreeView.BranchText>
				</TreeView.BranchControl>
				<TreeView.BranchContent>
					<TreeView.BranchIndentGuide />
					{#each node.children as childNode, childIndex (childNode)}
						{@render treeNode(childNode, [...indexPath, childIndex])}
					{/each}
				</TreeView.BranchContent>
			</TreeView.Branch>
		{:else if node.type === 'file'}
			<TreeView.Item>
				<div
					class="flex items-center justify-between w-full gap-2 group"
					role="button"
					tabindex="0"
					ondblclick={() => handleFileDoubleClick(node.fileData)}
					onkeydown={(e) => {
						if (e.key === 'Enter') handleFileDoubleClick(node.fileData);
					}}
				>
					<div class="flex items-center gap-2 flex-1 min-w-0">
						<IconFile class="size-4 flex-shrink-0" />
						{#if editingFile?.uuid === node.fileData.uuid}
							<input
								type="text"
								bind:value={editValue}
								class="input flex-1 min-w-0 py-0 px-1 h-6"
								onkeydown={(e) => {
									if (e.key === 'Enter') saveRename(node.fileData);
									if (e.key === 'Escape') cancelEditing();
								}}
								onclick={(e) => e.stopPropagation()}
							/>
							<button
								type="button"
								onclick={() => saveRename(node.fileData)}
								class="btn-icon btn-sm preset-tonal"
								title="Save"
							>
								✓
							</button>
							<button
								type="button"
								onclick={cancelEditing}
								class="btn-icon btn-sm preset-tonal"
								title="Cancel"
							>
								✕
							</button>
						{:else}
							<span class="truncate">{node.name}</span>
							<div
								class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										downloadFile(node.fileData);
									}}
									class="btn-icon btn-sm preset-filled-primary-500"
									title="Download"
								>
									<IconDownload class="size-3" />
								</button>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										startEditing(node.fileData);
									}}
									class="btn-icon btn-sm preset-filled-primary-500"
									title="Rename"
								>
									<IconEdit class="size-3" />
								</button>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										deletingFile = node.fileData;
									}}
									class="btn-icon btn-sm preset-filled-error-500"
									title="Delete"
								>
									<IconTrash class="size-3" />
								</button>
							</div>
						{/if}
					</div>
				</div>
			</TreeView.Item>
		{/if}
	</TreeView.NodeProvider>
{/snippet}
