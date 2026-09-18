<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { IconArrowLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import {
		getRequestReasonOptions,
		getTypeOfWorkOptions
	} from '$lib/remote/pipeline-records/record-options.remote';
	import {
		deletePipelineRecord,
		getPipelineRecord,
		updatePipelineRecord
	} from '$lib/remote/pipeline-records/records.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import { PipelineRecordDraft } from '../../components/PipelineRecordDraft.svelte';
	import PipelineRecordFields from '../../components/PipelineRecordFields.svelte';
	import InquiryActions from './InquiryActions.svelte';

	let { uuid }: { uuid: string } = $props();

	// The form edits a snapshot of the record; the page re-keys this component
	// per uuid, so the loads below run once per record.
	// svelte-ignore state_referenced_locally
	const [record, typeOfWork, requestReason] = await Promise.all([
		getPipelineRecord(uuid),
		getTypeOfWorkOptions(),
		getRequestReasonOptions()
	]);

	const draft = PipelineRecordDraft.fromRecord(record, { typeOfWork, requestReason });

	let isSaving = $state(false);
	let isDeleting = $state(false);
	let deleteMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);

	/** Saves the edited fields. */
	async function handleSave() {
		isSaving = true;
		try {
			await updatePipelineRecord({ uuid, ...draft.toInput() });
			globalToaster.success({
				title: m.title_success(),
				description: m.message_pipeline_record_updated()
			});
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_pipeline_record_update_failed()
			});
		} finally {
			isSaving = false;
		}
	}

	/** Deletes the record and returns to the list. */
	async function handleDelete() {
		isDeleting = true;
		try {
			await deletePipelineRecord(uuid);
			await goto(resolve('/pipeline-records'));
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_pipeline_record_delete_failed()
			});
		} finally {
			isDeleting = false;
		}
	}
</script>

{#snippet recordButtons(extraClass: string)}
	<button
		type="button"
		class={['btn preset-filled-error-500 inline-flex items-center gap-2', extraClass]}
		disabled={isDeleting}
		onclick={() => deleteMessageBox?.open()}
	>
		<IconTrash class="size-4 shrink-0" />
		<span>{m.common_delete()}</span>
	</button>
	<button
		type="button"
		class={['btn preset-filled-primary-500 inline-flex items-center gap-2', extraClass]}
		disabled={isSaving}
		onclick={handleSave}
	>
		{#if isSaving}
			<span>{m.common_loading()}</span>
		{:else}
			<IconDeviceFloppy class="size-4 shrink-0" />
			<span>{m.common_save()}</span>
		{/if}
	</button>
{/snippet}

<div class="space-y-3 sm:space-y-0">
	<div class="flex items-center justify-between gap-2">
		<button
			type="button"
			class="btn preset-tonal-surface inline-flex items-center gap-2"
			onclick={() => goto(resolve('/pipeline-records'))}
		>
			<IconArrowLeft class="size-4 shrink-0" />
			<span class="hidden sm:inline">{m.common_back()}</span>
		</button>

		<div class="hidden sm:flex items-center gap-2 shrink-0">
			<InquiryActions recordUuid={uuid} />
			{@render recordButtons('')}
		</div>
	</div>

	<div class="flex sm:hidden items-center gap-2">
		<InquiryActions recordUuid={uuid} buttonClass="flex-1" />
	</div>

	<div class="flex sm:hidden items-center gap-2">
		{@render recordButtons('flex-1')}
	</div>
</div>

<PipelineRecordFields {draft} projectLabel={record.project_name} />

<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm_delete()}
	message={m.message_confirm_delete_pipeline_record()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	closeText={m.common_cancel()}
	onAccept={handleDelete}
/>
