<script>
	import { SvelteMap } from 'svelte/reactivity';
	import { createTreeViewCollection, TreeView } from '@skeletonlabs/skeleton-svelte';
	import { IconDownload, IconEdit, IconFile, IconFolder, IconTrash } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
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
	let deleteMessageBox;

	/**
	 * Transform flat file list into tree structure
	 * Files are grouped by category (photos, documents, etc.)
	 */
	function buildTreeFromFiles(fileList) {
		const categoryMap = new SvelteMap();

		// Group files by category
		for (const file of fileList) {
			// Extract category from file path (e.g., "trenches/123/photos/image.jpg" -> "photos")
			const pathParts = decodeURIComponent(file.file_path).split('/');
			const category = pathParts.length >= 3 ? pathParts[pathParts.length - 2] : 'uncategorized';

			if (!categoryMap.has(category)) {
				categoryMap.set(category, []);
			}
			categoryMap.get(category).push(file);
		}

		// Build tree structure - sort categories alphabetically
		const children = [];
		const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) =>
			a[0].localeCompare(b[0])
		);

		for (const [category, categoryFiles] of sortedCategories) {
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
			const response = await fetch(
				`${PUBLIC_API_URL}feature-files/?object_id=${featureId}&page_size=100`,
				{
					credentials: 'include'
				}
			);

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
	 * Show delete confirmation dialog
	 */
	function confirmDelete(file) {
		deletingFile = file;
		deleteMessageBox.open();
	}

	/**
	 * Delete file
	 */
	async function deleteFile() {
		const file = deletingFile;
		if (!file) return;

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
		editValue = file.file_name;
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
			editValue += file.file_type ? `.${file.file_type}` : '';
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
			<p>{m.form_loading_files()}</p>
		</div>
	{:else if error}
		<div class="text-center py-8 text-error-500 space-y-2">
			<p>{m.form_error_loading_files({ error })}</p>
			<button type="button" onclick={loadFiles} class="btn preset-filled-primary-500">
				Retry
			</button>
		</div>
	{:else if files.length === 0}
		<div class="text-center py-8 text-surface-500">
			<p class="text-sm">{m.form_no_files_uploaded_yet()}</p>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			<TreeView {collection}>
				<TreeView.Label>{m.form_uploaded_files()}</TreeView.Label>
				<div class="max-h-96 overflow-y-auto overflow-x-hidden">
					<TreeView.Tree>
						{#each collection.rootNode.children || [] as node, index (node)}
							{@render treeNode(node, [index])}
						{/each}
					</TreeView.Tree>
				</div>
			</TreeView>
		</div>
	{/if}
</div>

<!-- Confirmation Dialog for Delete -->
<MessageBox
	bind:this={deleteMessageBox}
	heading={m.action_delete_file()}
	message={deletingFile
		? m.message_confirm_delete_file({
				file_name: deletingFile.file_name,
				file_type: deletingFile.file_type
			})
		: ''}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	closeText={m.common_cancel()}
	onAccept={deleteFile}
/>

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
					ondblclick={() => {
						if (editingFile?.uuid !== node.fileData.uuid) {
							handleFileDoubleClick(node.fileData);
						}
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' && editingFile?.uuid !== node.fileData.uuid) {
							handleFileDoubleClick(node.fileData);
						}
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
									if (e.key === 'Enter') {
										e.stopPropagation();
										e.preventDefault();
										saveRename(node.fileData);
									}
									if (e.key === 'Escape') {
										e.stopPropagation();
										cancelEditing();
									}
								}}
								onclick={(e) => e.stopPropagation()}
								ondblclick={(e) => e.stopPropagation()}
							/>
							<button
								type="button"
								onclick={() => saveRename(node.fileData)}
								class="btn-icon btn-sm preset-filled-primary-500"
								title={m.action_save()}
							>
								✓
							</button>
							<button
								type="button"
								onclick={cancelEditing}
								class="btn-icon btn-sm preset-filled-error-500"
								title={m.common_cancel()}
							>
								✕
							</button>
						{:else}
							<span class="truncate">{node.name}</span>
							<div
								class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										downloadFile(node.fileData);
									}}
									class="btn-icon btn-sm preset-filled-primary-500"
									title={m.action_download()}
								>
									<IconDownload class="size-4" />
								</button>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										startEditing(node.fileData);
									}}
									class="btn-icon btn-sm preset-filled-warning-500"
									title={m.action_rename()}
								>
									<IconEdit class="size-4" />
								</button>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										confirmDelete(node.fileData);
									}}
									class="btn-icon btn-sm preset-filled-error-500"
									title={m.action_delete_file()}
								>
									<IconTrash class="size-4" />
								</button>
							</div>
						{/if}
					</div>
				</div>
			</TreeView.Item>
		{/if}
	</TreeView.NodeProvider>
{/snippet}
