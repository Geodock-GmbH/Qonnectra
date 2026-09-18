<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { createPipelineRecord } from '$lib/remote/pipeline-records/records.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import { PipelineRecordDraft } from '../components/PipelineRecordDraft.svelte';
	import PipelineRecordFields from '../components/PipelineRecordFields.svelte';

	const draft = new PipelineRecordDraft();

	let isSaving = $state(false);

	const projects: { label: string; value: string }[] = $derived(page.data.projects ?? []);

	// The record is created in the app's active project, falling back to the
	// first one when the stored selection is no longer active.
	const activeProject = $derived(
		projects.find((project) => project.value === $selectedProject) ?? projects[0]
	);

	/** Creates the record in the active project and opens its detail page. */
	async function handleCreate() {
		if (!activeProject) return;

		isSaving = true;
		try {
			const created = await createPipelineRecord({
				projectId: Number(activeProject.value),
				...draft.toInput()
			});
			globalToaster.success({
				title: m.title_success(),
				description: m.message_pipeline_record_created()
			});
			await goto(resolve('/pipeline-records/[uuid]', { uuid: created.uuid }));
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_pipeline_record_create_failed()
			});
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>{m.nav_pipeline_records()}</title>
</svelte:head>

<div class="h-full overflow-y-auto p-4 sm:p-6">
	<div class="mx-auto max-w-3xl space-y-6">
		<div class="flex items-center">
			<button
				type="button"
				class="btn preset-tonal-surface inline-flex items-center gap-2"
				onclick={() => goto(resolve('/pipeline-records'))}
			>
				<IconArrowLeft class="size-4 shrink-0" />
				<span>{m.common_back()}</span>
			</button>
		</div>

		<QueryBoundary>
			<PipelineRecordFields {draft} projectLabel={activeProject?.label ?? ''} />

			<div class="flex justify-end">
				<button
					type="button"
					class="btn preset-filled-primary-500 inline-flex items-center gap-2"
					disabled={isSaving || !activeProject}
					onclick={handleCreate}
				>
					<IconDeviceFloppy class="size-4 shrink-0" />
					<span>{isSaving ? m.common_loading() : m.common_create()}</span>
				</button>
			</div>
		</QueryBoundary>
	</div>
</div>
