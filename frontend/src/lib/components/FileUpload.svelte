<script>
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';
	import { IconFile, IconUpload } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { fetchContentTypes, getContentTypeId } from '$lib/utils/contentTypes';

	/**
	 * @typedef {Object} FileUploadProps
	 * @property {string} featureType - The type of feature (e.g., 'cable', 'node', 'trench')
	 * @property {string} featureId - The UUID of the feature to attach files to
	 * @property {() => void} [onUploadComplete] - Optional callback called after files are uploaded
	 */

	/** @type {FileUploadProps} */
	let { featureType, featureId, onUploadComplete } = $props();

	let uploadedFiles = $state([]);
	let isUploading = $state(false);
	let isLoadingFiles = $state(false);
	let contentTypeError = $state(null);

	let contentTypesLoaded = $state(false);
	let maxFileSize = $state(50 * 1024 * 1024); // 50MB

	const contentTypeId = $derived(contentTypesLoaded ? getContentTypeId(featureType) : null);

	/**
	 * Load content types from the API
	 */
	async function loadContentTypes() {
		try {
			await fetchContentTypes();
			contentTypesLoaded = true;
		} catch (error) {
			console.error('Error fetching content types:', error);
			contentTypeError = 'Failed to load content types';
		}
	}

	/**
	 * Validate contentTypeId whenever it changes
	 */
	$effect(() => {
		if (contentTypesLoaded && !contentTypeId) {
			console.warn(`No ContentType ID found for feature type: ${featureType}`);
			contentTypeError = `Invalid feature type: ${featureType}`;
		} else if (contentTypesLoaded && contentTypeId) {
			// Clear error when valid
			contentTypeError = null;
		}
	});

	/**
	 * Load existing files for this feature
	 */
	async function loadFiles() {
		if (!featureId) return;

		isLoadingFiles = true;
		try {
			const response = await fetch(`${PUBLIC_API_URL}feature-files/?object_id=${featureId}`, {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Failed to load files: ${response.status}`);
			}

			uploadedFiles = await response.json();
		} catch (error) {
			console.error('Error loading files:', error);
			globalToaster.error({
				title: m.common_error(),
				description: 'Failed to load files'
			});
		} finally {
			isLoadingFiles = false;
		}
	}

	// Retry loading content types
	function retryLoadContentTypes() {
		contentTypeError = null;
		contentTypesLoaded = false;
		loadContentTypes();
	}

	/**
	 * Upload files from Skeleton FileUpload component
	 */
	async function uploadFilesFromPicker(fileUploadApi) {
		const selectedFiles = fileUploadApi.acceptedFiles;

		if (selectedFiles.length === 0) {
			globalToaster.warning({
				title: m.common_error(),
				description: 'Please select files to upload'
			});
			return;
		}

		if (!contentTypeId) {
			globalToaster.error({
				title: m.common_error(),
				description: 'Invalid feature type'
			});
			return;
		}

		isUploading = true;

		try {
			// Upload each file separately
			for (const file of selectedFiles) {
				const formData = new FormData();
				formData.append('file_path', file);
				formData.append('object_id', featureId);
				formData.append('content_type', contentTypeId);
				formData.append('description', '');

				const response = await fetch(`${PUBLIC_API_URL}feature-files/`, {
					method: 'POST',
					credentials: 'include',
					body: formData
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.detail || `Failed to upload ${file.name}`);
				}
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_uploading_files()
			});

			// Clear the file picker and reload the list
			fileUploadApi.clearFiles();
			await loadFiles();

			// Notify parent component
			if (onUploadComplete) {
				onUploadComplete();
			}
		} catch (error) {
			console.error('Error uploading files:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message || 'Failed to upload files'
			});
		} finally {
			isUploading = false;
		}
	}

	$effect(() => {
		if (featureId && featureType && !contentTypesLoaded) {
			loadContentTypes();
		}
	});

	$effect(() => {
		if (featureId && featureType && contentTypesLoaded) {
			loadFiles();
		}
	});
</script>

<div class="flex flex-col gap-4 p-4">
	<!-- Loading State -->
	{#if !contentTypesLoaded && !contentTypeError}
		<div class="text-center py-8 text-surface-500">
			<p>Loading...</p>
		</div>
	{:else if contentTypeError}
		<div class="text-center py-8 text-error-500 space-y-2">
			<p>Unable to load file upload. {contentTypeError}</p>
			<button type="button" onclick={retryLoadContentTypes} class="btn preset-filled-primary-500">
				Retry
			</button>
		</div>
	{:else}
		<!-- File Upload Section -->
		<div class="grid gap-4 w-full">
			<h3 class="text-lg font-semibold">{m.form_upload_files()}</h3>

			<!-- File Upload Component -->
			<FileUpload maxFiles={Infinity} {maxFileSize}>
				<FileUpload.Dropzone
					class="border-2 border-dashed border-surface-400 rounded-lg p-8 text-center hover:border-primary-500 transition-colors"
				>
					<div class="flex flex-col items-center gap-2">
						<IconFile size={48} />
						<p class="text-sm">{m.form_select_files_or_drag()}</p>
						<p class="text-sm">
							{m.form_max_file_size()}: {Math.round(maxFileSize / 1024 / 1024)} MB
						</p>
						<FileUpload.Trigger class="preset-filled-primary-500"
							>{m.action_browse_files()}</FileUpload.Trigger
						>
						<FileUpload.HiddenInput />
					</div>
				</FileUpload.Dropzone>

				<!-- Selected Files Preview -->
				<FileUpload.ItemGroup>
					<FileUpload.Context>
						{#snippet children(fileUpload)}
							{#if fileUpload().acceptedFiles.length > 0}
								{#each fileUpload().acceptedFiles as file (file.name)}
									<FileUpload.Item {file} class="rounded-lg">
										<div class="col-span-3 flex items-center justify-between w-full">
											<FileUpload.ItemName>{file.name}</FileUpload.ItemName>
											<FileUpload.ItemDeleteTrigger />
										</div>
									</FileUpload.Item>
								{/each}
								<button
									type="button"
									onclick={() => uploadFilesFromPicker(fileUpload())}
									disabled={isUploading}
									class="btn preset-filled-primary-500 w-full"
								>
									{#if isUploading}
										<span>Uploading...</span>
									{:else}
										<IconUpload size={16} />
										<span
											>Upload {fileUpload().acceptedFiles.length}x
											{m.form_files({ count: fileUpload().acceptedFiles.length })}</span
										>
									{/if}
								</button>
							{/if}
						{/snippet}
					</FileUpload.Context>
				</FileUpload.ItemGroup>
			</FileUpload>
		</div>
	{/if}
</div>
