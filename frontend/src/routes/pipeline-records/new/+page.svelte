<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { IconArrowLeft } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import PipelineRecordForm from '../PipelineRecordForm.svelte';

	let { data } = $props();

	let isSaving = $state(false);

	const projectOptions = $derived(data.projectOptions || []);
	const typeOfWorkOptions = $derived(data.typeOfWorkOptions || []);
	const requestReasonOptions = $derived(data.requestReasonOptions || []);

	/**
	 * Snapshots the active project id from initial page data.
	 * @returns {any} The active project id at mount time.
	 */
	function getInitialActiveProjectId() {
		return data.activeProjectId ?? '';
	}

	let projectId = $state(getInitialActiveProjectId());

	$effect(() => {
		if ($selectedProject) {
			projectId = $selectedProject;
		}
	});
	let typeOfWorkId = $state('');
	let requestReasonId = $state('');
	let organisation = $state('');
	let name = $state('');
	let tel = $state('');
	let mobile = $state('');

	/** Submits the current form values to the create action. */
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
			const response = await fetch('?/createPipelineRecord', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'redirect') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_pipeline_record_created()
				});
				goto(result.location);
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_pipeline_record_create_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			globalToaster.error({ title: m.common_error(), description: err.message });
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
				onclick={() => goto('/pipeline-records')}
			>
				<IconArrowLeft class="size-4 shrink-0" />
				<span>{m.common_back()}</span>
			</button>
		</div>

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
			{isSaving}
			projectReadonly={true}
			saveLabel={m.common_create()}
			onSave={handleSave}
		/>
	</div>
</div>
