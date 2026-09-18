<script lang="ts">
	import type { PipelineRecordDraft } from './PipelineRecordDraft.svelte';
	import { IconBuilding, IconPhone, IconUser } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import {
		getRequestReasonOptions,
		getTypeOfWorkOptions
	} from '$lib/remote/pipeline-records/record-options.remote';

	interface Props {
		draft: PipelineRecordDraft;
		/** The project is fixed: the active project on create, the record's own afterwards. */
		projectLabel: string;
	}

	let { draft, projectLabel }: Props = $props();

	const [typeOfWorkOptions, requestReasonOptions] = await Promise.all([
		getTypeOfWorkOptions(),
		getRequestReasonOptions()
	]);
</script>

<div class="space-y-6">
	<div class="card p-4 sm:p-6 space-y-4">
		<div class="flex items-center gap-3">
			<IconBuilding class="size-5 text-primary-500" />
			<h2 class="text-lg font-semibold">{m.form_project({ count: 1 })}</h2>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="label">
				<span class="label-text text-sm text-surface-900-100">
					{m.form_project({ count: 1 })} *
				</span>
				<input
					type="text"
					class="input"
					value={projectLabel}
					readonly
					aria-readonly="true"
					data-testid="active-project"
				/>
			</label>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_type_of_work()}</span>
				<GenericCombobox
					data={typeOfWorkOptions}
					value={draft.typeOfWorkId ? [draft.typeOfWorkId] : []}
					placeholder="-"
					onValueChange={(e) => {
						draft.typeOfWorkId = e.value[0] ?? '';
					}}
				/>
			</label>

			<label class="label sm:col-span-2">
				<span class="label-text text-sm text-surface-900-100">{m.form_request_reason()}</span>
				<GenericCombobox
					data={requestReasonOptions}
					value={draft.requestReasonId ? [draft.requestReasonId] : []}
					placeholder="-"
					onValueChange={(e) => {
						draft.requestReasonId = e.value[0] ?? '';
					}}
				/>
			</label>
		</div>
	</div>

	<div class="card p-4 sm:p-6 space-y-4">
		<div class="flex items-center gap-3">
			<IconUser class="size-5 text-primary-500" />
			<h2 class="text-lg font-semibold">{m.form_organisation()}</h2>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_organisation()}</span>
				<input type="text" class="input" name="organisation" bind:value={draft.organisation} />
			</label>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_name()}</span>
				<input type="text" class="input" name="name" bind:value={draft.name} />
			</label>
		</div>
	</div>

	<div class="card p-4 sm:p-6 space-y-4">
		<div class="flex items-center gap-3">
			<IconPhone class="size-5 text-primary-500" />
			<h2 class="text-lg font-semibold">{m.form_tel()}</h2>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_tel()}</span>
				<input type="text" class="input" name="tel" bind:value={draft.tel} />
			</label>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_mobile()}</span>
				<input type="text" class="input" name="mobile" bind:value={draft.mobile} />
			</label>
		</div>
	</div>
</div>
