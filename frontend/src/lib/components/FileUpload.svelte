<script lang="ts">
	import { onMount } from 'svelte';
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';
	import { IconFile, IconUpload } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { fetchContentTypes, getContentTypeId } from '$lib/utils/contentTypes';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';

	interface FileUploadProps {
		/** The type of feature (e.g., 'cable', 'node', 'trench') */
		featureType: string;
		/** The UUID of the feature to attach files to */
		featureId: string;
		/** Optional callback called after files are uploaded */
		onUploadComplete?: () => void;
	}

	let { featureType, featureId, onUploadComplete }: FileUploadProps = $props();

	let isUploading = $state(false);
	let loadError = $state<string | null>(null);

	let contentTypesLoaded = $state(false);
	let maxFileSize = $state(50 * 1024 * 1024);

	const contentTypeId = $derived(contentTypesLoaded ? getContentTypeId(featureType) : null);

	const contentTypeError = $derived(
		loadError ??
			(contentTypesLoaded && !contentTypeId
				? m.message_error_invalid_feature_type({ featureType })
				: null)
	);

	/**
	 * Load content types from the API
	 */
	async function loadContentTypes() {
		try {
			await fetchContentTypes();
			contentTypesLoaded = true;
		} catch (error) {
			console.error('Error fetching content types:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching content types',
				extraData: {
					from: 'FileUpload.loadContentTypes',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			loadError = m.message_error_loading_content_types();
		}
	}

	function retryLoadContentTypes() {
		loadError = null;
		contentTypesLoaded = false;
		loadContentTypes();
	}

	/**
	 * Upload files from Skeleton FileUpload component
	 */
	async function uploadFilesFromPicker(fileUploadApi: {
		acceptedFiles: File[];
		clearFiles: () => void;
	}) {
		const selectedFiles = fileUploadApi.acceptedFiles;

		if (selectedFiles.length === 0) {
			globalToaster.warning({
				title: m.common_error(),
				description: m.message_error_no_files_selected()
			});
			return;
		}

		if (!contentTypeId) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_invalid_feature_type({ featureType })
			});
			return;
		}

		isUploading = true;

		try {
			for (const file of selectedFiles) {
				const formData = new FormData();
				formData.append('file_path', file);
				formData.append('object_id', featureId);
				formData.append('content_type', String(contentTypeId));
				formData.append('description', '');

				const response = await fetch(`${PUBLIC_API_URL}feature-files/`, {
					method: 'POST',
					credentials: 'include',
					body: formData
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(
						errorData.detail || m.message_error_uploading_file({ fileName: file.name })
					);
				}
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_uploading_files()
			});

			fileUploadApi.clearFiles();

			if (onUploadComplete) {
				onUploadComplete();
			}
		} catch (error) {
			console.error('Error uploading files:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error uploading files',
				extraData: {
					from: 'FileUpload.uploadFilesFromPicker',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: error instanceof Error ? error.message : m.message_error_uploading_files()
			});
		} finally {
			isUploading = false;
		}
	}

	onMount(loadContentTypes);
</script>

<div class="flex flex-col gap-4 p-4">
	<!-- Loading State -->
	{#if !contentTypesLoaded && !contentTypeError}
		<div class="text-center py-8 text-surface-500">
			<p>{m.common_loading()}</p>
		</div>
	{:else if contentTypeError}
		<div class="text-center py-8 text-error-500 space-y-2">
			<p>{m.message_error_file_upload_unavailable({ error: contentTypeError })}</p>
			<button type="button" onclick={retryLoadContentTypes} class="btn preset-filled-primary-500">
				{m.common_retry()}
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
										<span>{m.common_uploading()}</span>
									{:else}
										<IconUpload size={16} />
										<span
											>{m.action_upload_file_count({
												count: fileUpload().acceptedFiles.length
											})}</span
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
