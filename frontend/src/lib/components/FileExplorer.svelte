<script>
	import { SvelteMap } from 'svelte/reactivity';
	import { createTreeViewCollection, TreeView } from '@skeletonlabs/skeleton-svelte';
	import {
		IconCalendar,
		IconDownload,
		IconEdit,
		IconFile,
		IconFileText,
		IconFileTypeCsv,
		IconFileTypeDocx,
		IconFileTypeJpg,
		IconFileTypePdf,
		IconFileTypePng,
		IconFileTypeXls,
		IconFileZip,
		IconFolder,
		IconPhoto,
		IconSearch,
		IconTrash
	} from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { tooltip } from '$lib/utils/tooltip.js';

	/**
	 * @typedef {Object} FeatureFile
	 * @property {string} uuid
	 * @property {string} file_name
	 * @property {string} file_type
	 * @property {string} file_path
	 * @property {string} [created_at]
	 */

	/**
	 * @typedef {Object} FileExplorerProps
	 * @property {string} featureType - The type of feature (e.g., 'cable', 'node', 'trench')
	 * @property {string} featureId - The UUID of the feature
	 */

	/** @type {FileExplorerProps} */
	let { featureType, featureId } = $props();

	/** @type {FeatureFile[]} */
	let files = $state([]);
	let isLoading = $state(false);
	/** @type {string|null} */
	let error = $state(null);
	/** @type {FeatureFile|null} */
	let editingFile = $state(null);
	let editValue = $state('');
	/** @type {string|null} */
	let expandedFileId = $state(null);
	/** @type {FeatureFile|null} */
	let deletingFile = $state(null);
	/** @type {MessageBox} */
	let deleteMessageBox;

	let searchQuery = $state('');
	/** @type {'name'|'date'|'type'} */
	let sortBy = $state('name');

	/**
	 * Map a file extension to an icon component and a badge accent color.
	 * Keeps file rows scannable at a glance without needing thumbnails.
	 * @param {string} fileType
	 */
	function getFileVisual(fileType) {
		const ext = (fileType || '').toLowerCase();

		if (['pdf'].includes(ext)) return { icon: IconFileTypePdf, accent: 'text-error-500' };
		if (['png'].includes(ext)) return { icon: IconFileTypePng, accent: 'text-success-500' };
		if (['jpg', 'jpeg'].includes(ext)) return { icon: IconFileTypeJpg, accent: 'text-success-500' };
		if (['gif', 'webp', 'svg', 'bmp', 'tif', 'tiff'].includes(ext))
			return { icon: IconPhoto, accent: 'text-success-500' };
		if (['xls', 'xlsx'].includes(ext)) return { icon: IconFileTypeXls, accent: 'text-success-700' };
		if (['csv'].includes(ext)) return { icon: IconFileTypeCsv, accent: 'text-success-700' };
		if (['doc', 'docx'].includes(ext))
			return { icon: IconFileTypeDocx, accent: 'text-tertiary-500' };
		if (['txt', 'md', 'rtf'].includes(ext))
			return { icon: IconFileText, accent: 'text-surface-500' };
		if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
			return { icon: IconFileZip, accent: 'text-warning-500' };

		return { icon: IconFile, accent: 'text-surface-500' };
	}

	/**
	 * Format an ISO timestamp into a short, locale-aware date.
	 * @param {string|undefined} value
	 */
	function formatDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	const filteredFiles = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		const list = query
			? files.filter((file) => file.file_name.toLowerCase().includes(query))
			: [...files];

		list.sort((a, b) => {
			if (sortBy === 'name') return a.file_name.localeCompare(b.file_name);
			if (sortBy === 'type') return (a.file_type || '').localeCompare(b.file_type || '');
			return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
		});

		return list;
	});

	/**
	 * Transform flat file list into tree structure.
	 * Files are grouped by category (photos, documents, etc.) derived from their path.
	 * @param {FeatureFile[]} fileList
	 */
	function buildTreeFromFiles(fileList) {
		const categoryMap = new SvelteMap();

		for (const file of fileList) {
			const pathParts = decodeURIComponent(file.file_path).split('/');
			const category = pathParts.length >= 3 ? pathParts[pathParts.length - 2] : 'uncategorized';

			if (!categoryMap.has(category)) {
				categoryMap.set(category, []);
			}
			categoryMap.get(category).push(file);
		}

		const children = [];
		const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) =>
			a[0].localeCompare(b[0])
		);

		for (const [category, categoryFiles] of sortedCategories) {
			children.push({
				id: `category-${category}`,
				name: `${category} (${categoryFiles.length})`,
				type: 'category',
				children: categoryFiles.map((/** @type {FeatureFile} */ file) => ({
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

	const collection = $derived(buildTreeFromFiles(filteredFiles));

	/**
	 * Load files from API.
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
			error = err instanceof Error ? err.message : String(err);
			globalToaster.error({
				title: m.common_error(),
				description: 'Failed to load files'
			});
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Open a file preview in a new tab.
	 * @param {FeatureFile} file
	 */
	function handleFileDoubleClick(file) {
		const url = `${PUBLIC_API_URL}feature-files/${file.uuid}/preview/`;
		window.open(url, '_blank');
	}

	/**
	 * Download a file in a new tab.
	 * @param {FeatureFile} file
	 */
	function downloadFile(file) {
		const url = `${PUBLIC_API_URL}feature-files/${file.uuid}/download/`;
		window.open(url, '_blank');
	}

	/**
	 * Show the delete confirmation dialog for a file.
	 * @param {FeatureFile} file
	 */
	function confirmDelete(file) {
		deletingFile = file;
		deleteMessageBox.open();
	}

	/**
	 * Delete the file currently staged for deletion.
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
	 * Start editing a file name.
	 * @param {FeatureFile} file
	 */
	function startEditing(file) {
		editingFile = file;
		editValue = file.file_name;
	}

	/**
	 * Cancel editing.
	 */
	function cancelEditing() {
		editingFile = null;
		editValue = '';
	}

	/**
	 * Save a file rename.
	 * @param {FeatureFile} file
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
	 * Public method to refresh files (can be called by parent).
	 */
	export function refresh() {
		loadFiles();
	}

	$effect(() => {
		if (featureId && featureType) {
			loadFiles();
		}
	});
</script>

<div class="flex w-full flex-col gap-4 p-4">
	{#if isLoading}
		<div class="text-surface-950-50 py-8 text-center">
			<p>{m.form_loading_files()}</p>
		</div>
	{:else if error}
		<div class="text-error-500 space-y-2 py-8 text-center">
			<p>{m.form_error_loading_files({ error })}</p>
			<button type="button" onclick={loadFiles} class="btn preset-filled-primary-500">
				{m.action_refresh()}
			</button>
		</div>
	{:else if files.length === 0}
		<div class="text-surface-950-50 py-8 text-center">
			<p class="text-sm">{m.form_no_files_uploaded_yet()}</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<label class="input flex grow items-center gap-2">
					<IconSearch class="size-4 shrink-0 opacity-60" />
					<input
						type="search"
						bind:value={searchQuery}
						placeholder={m.form_search_files()}
						class="grow border-0 bg-transparent p-0 focus:ring-0"
					/>
				</label>
				<select bind:value={sortBy} class="select w-full sm:w-auto">
					<option value="name">{m.common_name()}</option>
					<option value="date">{m.form_sort_by_date()}</option>
					<option value="type">{m.form_sort_by_type()}</option>
				</select>
			</div>

			{#if filteredFiles.length === 0}
				<div class="text-surface-950-50 py-8 text-center text-sm">
					<p>{m.form_no_files_match_search({ query: searchQuery })}</p>
				</div>
			{:else}
				<TreeView {collection}>
					<TreeView.Label>{m.form_uploaded_files()}</TreeView.Label>
					<div class="max-h-[60vh] overflow-y-auto overflow-x-hidden">
						<TreeView.Tree>
							{#each collection.rootNode.children || [] as node, index (node.id)}
								{@render treeNode(node, [index])}
							{/each}
						</TreeView.Tree>
					</div>
				</TreeView>
			{/if}
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

{#snippet treeNode(/** @type {any} */ node, /** @type {number[]} */ indexPath)}
	<TreeView.NodeProvider value={{ node, indexPath }}>
		{#if node.type === 'category'}
			<TreeView.Branch>
				<TreeView.BranchControl>
					<TreeView.BranchIndicator />
					<TreeView.BranchText class="flex items-center gap-2 font-medium">
						<IconFolder class="text-primary-500 size-4 shrink-0" />
						{node.name}
					</TreeView.BranchText>
				</TreeView.BranchControl>
				<TreeView.BranchContent>
					<TreeView.BranchIndentGuide />
					{#each node.children as childNode, childIndex (childNode.id)}
						{@render treeNode(childNode, [...indexPath, childIndex])}
					{/each}
				</TreeView.BranchContent>
			</TreeView.Branch>
		{:else if node.type === 'file'}
			{@const visual = getFileVisual(node.fileData.file_type)}
			{@const uploaded = formatDate(node.fileData.created_at)}
			<TreeView.Item>
				<div
					class="group hover:bg-surface-200-800 flex w-full flex-col rounded-md transition-colors"
				>
					<div
						class="flex w-full items-center gap-3 px-2 py-1.5"
						role="button"
						tabindex="0"
						onclick={() => {
							if (editingFile?.uuid !== node.fileData.uuid) {
								expandedFileId = expandedFileId === node.fileData.uuid ? null : node.fileData.uuid;
							}
						}}
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
						<visual.icon class="size-5 shrink-0 {visual.accent}" />
						{#if editingFile?.uuid === node.fileData.uuid}
							<input
								type="text"
								bind:value={editValue}
								class="input h-7 min-w-0 flex-1 px-2 py-0"
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
								class="btn-icon btn-sm preset-filled-primary-500 shrink-0"
								aria-label={m.action_save()}
								{@attach tooltip(m.action_save())}
							>
								✓
							</button>
							<button
								type="button"
								onclick={cancelEditing}
								class="btn-icon btn-sm preset-filled-error-500 shrink-0"
								aria-label={m.common_cancel()}
								{@attach tooltip(m.common_cancel())}
							>
								✕
							</button>
						{:else}
							<div class="flex min-w-0 flex-1 flex-col">
								<span class="truncate" title={node.name}>{node.name}</span>
								{#if uploaded}
									<span class="text-surface-600-400 flex items-center gap-1 text-xs sm:hidden">
										<IconCalendar class="size-3 shrink-0" />
										{uploaded}
									</span>
								{/if}
							</div>

							{#if uploaded}
								<span
									class="text-surface-600-400 hidden shrink-0 items-center gap-1 text-xs sm:flex sm:group-hover:hidden"
								>
									<IconCalendar class="size-3.5 shrink-0" />
									{uploaded}
								</span>
							{/if}

							<!-- Desktop: hover to reveal actions; occupies the metadata slot so nothing shifts -->
							<div
								class="hidden shrink-0 items-center gap-1 opacity-0 transition-opacity sm:flex sm:group-hover:opacity-100"
							>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										downloadFile(node.fileData);
									}}
									class="btn-icon btn-sm preset-filled-primary-500"
									aria-label={m.action_download()}
									{@attach tooltip(m.action_download())}
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
									aria-label={m.action_rename()}
									{@attach tooltip(m.action_rename())}
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
									aria-label={m.action_delete_file()}
									{@attach tooltip(m.action_delete_file())}
								>
									<IconTrash class="size-4" />
								</button>
							</div>
						{/if}
					</div>

					<!-- Mobile: tap to expand action buttons below -->
					{#if expandedFileId === node.fileData.uuid && editingFile?.uuid !== node.fileData.uuid}
						<div class="flex items-center gap-2 px-2 pb-2 pl-9 sm:hidden">
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									handleFileDoubleClick(node.fileData);
								}}
								class="btn btn-sm preset-filled-surface-500"
								aria-label={m.action_open()}
							>
								{m.action_open()}
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									downloadFile(node.fileData);
								}}
								class="btn-icon btn-sm preset-filled-primary-500"
								aria-label={m.action_download()}
							>
								<IconDownload class="size-4" />
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									startEditing(node.fileData);
									expandedFileId = null;
								}}
								class="btn-icon btn-sm preset-filled-warning-500"
								aria-label={m.action_rename()}
							>
								<IconEdit class="size-4" />
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									confirmDelete(node.fileData);
									expandedFileId = null;
								}}
								class="btn-icon btn-sm preset-filled-error-500"
								aria-label={m.action_delete_file()}
							>
								<IconTrash class="size-4" />
							</button>
						</div>
					{/if}
				</div>
			</TreeView.Item>
		{/if}
	</TreeView.NodeProvider>
{/snippet}
