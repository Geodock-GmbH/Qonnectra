<script lang="ts">
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';
	import { IconDownload, IconLoader2, IconUpload } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { getConduitList, importConduits } from '$lib/remote/conduit/conduits.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

	let uploadFormRef = $state<HTMLFormElement | null>(null);
	const isUploading = $derived(importConduits.pending > 0);

	// Format/size problems come back as form issues (submit resolves false);
	// backend rejections reject with the row errors as the message.
	const uploadForm = importConduits.enhance(async (form) => {
		try {
			const accepted = await form.submit().updates(getConduitList);
			if (!accepted) {
				globalToaster.error({
					title: m.title_import_conduits_error(),
					description:
						(form.fields.allIssues() ?? []).map((issue) => issue.message).join('\n') ||
						m.message_please_try_again()
				});
				return;
			}

			const result = form.result;
			if (result?.warnings.length) {
				globalToaster.warning({
					title: m.common_warning(),
					description: result.warnings.join('\n')
				});
			}
			globalToaster.success({
				title: m.title_import_conduits_success(),
				description: m.message_import_conduits_success_description({
					count: result?.createdCount ?? 0
				})
			});
		} catch (err) {
			globalToaster.error({
				title: m.title_import_conduits_error(),
				description: remoteErrorMessage(err) ?? m.message_please_try_again()
			});
		}
	});

	/**
	 * Submits the form as soon as a file is picked.
	 * @param files - The accepted files.
	 */
	function handleFileSelect(files: File[]) {
		if (files.length > 0) uploadFormRef?.requestSubmit();
	}

	/**
	 * Downloads the Excel import template through the route's download endpoint.
	 */
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

<nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row">
	<form {...uploadForm} enctype="multipart/form-data" bind:this={uploadFormRef}>
		<FileUpload
			accept={XLSX_MIME}
			maxFiles={1}
			name="file"
			disabled={isUploading}
			onFileChange={(details) => handleFileSelect(details.acceptedFiles)}
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
	<button type="button" onclick={downloadTemplate} class="btn preset-filled-primary-500">
		<IconDownload class="size-4" />
		<span>{m.form_template()}</span>
	</button>
</nav>
