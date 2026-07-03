<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { IconArrowLeft, IconDeviceFloppy, IconMapSearch, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	import PipelineRecordForm from '../PipelineRecordForm.svelte';

	let { data } = $props();

	let isSaving = $state(false);
	let isDeleting = $state(false);

	const record = $derived(data.record);
	const recordError = $derived(data.recordError);
	const projectOptions = $derived(data.projectOptions || []);
	const typeOfWorkOptions = $derived(data.typeOfWorkOptions || []);
	const requestReasonOptions = $derived(data.requestReasonOptions || []);

	/**
	 * Snapshots the initial page data so form fields aren't clobbered on refresh.
	 * @returns {any} The page data object at mount time.
	 */
	function getInitialData() {
		return data;
	}
	const initialData = /** @type {any} */ (getInitialData());
	const initialRecord = initialData.record;

	/**
	 * Resolves the option value (id) whose label matches the given display string.
	 * The detail serializer exposes related names, not ids, so we match by label.
	 * @param {Array<{value: any, label: string}>} options - Combobox options.
	 * @param {string} label - The display string from the record.
	 * @returns {any} The matching option value, or '' when none matches.
	 */
	function resolveOptionValue(options, label) {
		if (!label) return '';
		const match = (options || []).find((o) => o.label === label);
		return match ? match.value : '';
	}

	let projectId = $state(
		resolveOptionValue(initialData.projectOptions, initialRecord?.project_name)
	);
	let typeOfWorkId = $state(
		resolveOptionValue(initialData.typeOfWorkOptions, initialRecord?.type_of_work)
	);
	let requestReasonId = $state(
		resolveOptionValue(initialData.requestReasonOptions, initialRecord?.request_reason)
	);
	let organisation = $state(initialRecord?.organisation || '');
	let name = $state(initialRecord?.name || '');
	let tel = $state(initialRecord?.tel || '');
	let mobile = $state(initialRecord?.mobile || '');

	/** @type {any} */
	let deleteMessageBox = $state(null);

	/** Submits the current form values to the update action. */
	async function handleSave() {
		isSaving = true;
		const formData = new FormData();
		formData.append('project', String(projectId ?? ''));
		formData.append('type_of_work_value', String(typeOfWorkId ?? ''));
		formData.append('request_reason_value', String(requestReasonId ?? ''));
		formData.append('organisation', organisation);
		formData.append('name', name);
		formData.append('tel', tel);
		formData.append('mobile', mobile);

		try {
			const response = await fetch('?/updatePipelineRecord', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_pipeline_record_updated()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_pipeline_record_update_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			globalToaster.error({ title: m.common_error(), description: err.message });
		} finally {
			isSaving = false;
		}
	}

	/** Opens the delete confirmation dialog. */
	function openDeleteConfirm() {
		deleteMessageBox?.open();
	}

	/** Submits the delete action and navigates back to the list on success. */
	async function handleDelete() {
		isDeleting = true;
		try {
			const response = await fetch('?/deletePipelineRecord', {
				method: 'POST',
				body: new FormData()
			});
			const result = deserialize(await response.text());

			if (result.type === 'redirect') {
				goto(result.location);
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_pipeline_record_delete_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			globalToaster.error({ title: m.common_error(), description: err.message });
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>{m.nav_pipeline_records()}</title>
</svelte:head>

<div class="h-full overflow-y-auto p-4 sm:p-6">
	<div class="mx-auto max-w-3xl space-y-6">
		<div class="flex items-center justify-between">
			<button
				type="button"
				class="btn preset-tonal-surface inline-flex items-center gap-2"
				onclick={() => goto('/pipeline-records')}
			>
				<IconArrowLeft class="size-4 shrink-0" />
				<span>{m.common_back()}</span>
			</button>

			<div class="flex items-center gap-2">
				{#if record}
					<button
						type="button"
						class="btn preset-filled-secondary-500 inline-flex items-center gap-2"
						onclick={() => goto(`/pipeline-records/${record.uuid}/inquiry`)}
					>
						<IconMapSearch class="size-4 shrink-0" />
						<span>{m.action_new_inquiry()}</span>
					</button>
				{/if}
				<button
					type="button"
					class="btn preset-filled-error-500 inline-flex items-center gap-2"
					disabled={isDeleting}
					onclick={openDeleteConfirm}
				>
					<IconTrash class="size-4 shrink-0" />
					<span>{m.common_delete()}</span>
				</button>
				<button
					type="button"
					class="btn preset-filled-primary-500 inline-flex items-center gap-2"
					disabled={isSaving || !projectId}
					onclick={handleSave}
				>
					{#if isSaving}
						<span>{m.common_loading()}</span>
					{:else}
						<IconDeviceFloppy class="size-4 shrink-0" />
						<span>{m.common_save()}</span>
					{/if}
				</button>
			</div>
		</div>

		{#if recordError}
			<div class="card preset-tonal-error p-4">{recordError}</div>
		{:else if record}
			<PipelineRecordForm
				bind:projectId
				bind:typeOfWorkId
				bind:requestReasonId
				bind:organisation
				bind:name
				bind:tel
				bind:mobile
				{projectOptions}
				{typeOfWorkOptions}
				{requestReasonOptions}
				projectReadonly={true}
			/>
		{/if}
	</div>
</div>

<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm_delete()}
	message={m.message_confirm_delete_pipeline_record()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	closeText={m.common_cancel()}
	onAccept={handleDelete}
/>
