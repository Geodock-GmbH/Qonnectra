<script>
	import { IconBuilding, IconDeviceFloppy, IconPhone, IconUser } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	let {
		projectId = $bindable(''),
		typeOfWorkId = $bindable(''),
		requestReasonId = $bindable(''),
		organisation = $bindable(''),
		name = $bindable(''),
		tel = $bindable(''),
		mobile = $bindable(''),
		projectOptions = [],
		typeOfWorkOptions = [],
		requestReasonOptions = [],
		isSaving = false,
		projectReadonly = false,
		saveLabel = m.common_save(),
		onSave
	} = $props();

	const activeProjectLabel = $derived(
		projectOptions.find((/** @type {{ value: any }} */ o) => String(o.value) === String(projectId))
			?.label ?? ''
	);
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
				{#if projectReadonly}
					<input
						type="text"
						class="input"
						value={activeProjectLabel}
						readonly
						aria-readonly="true"
						data-testid="active-project"
					/>
					<span class="text-xs text-surface-500">{m.hint_project_from_active_selector()}</span>
				{:else}
					<GenericCombobox
						data={projectOptions}
						value={projectId ? [projectId] : []}
						placeholder="-"
						required={true}
						onValueChange={(/** @type {{ value: any[] }} */ e) => {
							projectId = e.value[0] ?? '';
						}}
					/>
				{/if}
			</label>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_type_of_work()}</span>
				<GenericCombobox
					data={typeOfWorkOptions}
					value={typeOfWorkId ? [typeOfWorkId] : []}
					placeholder="-"
					onValueChange={(/** @type {{ value: any[] }} */ e) => {
						typeOfWorkId = e.value[0] ?? '';
					}}
				/>
			</label>

			<label class="label sm:col-span-2">
				<span class="label-text text-sm text-surface-900-100">{m.form_request_reason()}</span>
				<GenericCombobox
					data={requestReasonOptions}
					value={requestReasonId ? [requestReasonId] : []}
					placeholder="-"
					onValueChange={(/** @type {{ value: any[] }} */ e) => {
						requestReasonId = e.value[0] ?? '';
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
				<input type="text" class="input" name="organisation" bind:value={organisation} />
			</label>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_name()}</span>
				<input type="text" class="input" name="name" bind:value={name} />
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
				<input type="text" class="input" name="tel" bind:value={tel} />
			</label>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_mobile()}</span>
				<input type="text" class="input" name="mobile" bind:value={mobile} />
			</label>
		</div>
	</div>

	{#if onSave}
		<div class="flex justify-end">
			<button
				type="button"
				class="btn preset-filled-primary-500 inline-flex items-center gap-2"
				disabled={isSaving || !projectId}
				onclick={() => onSave?.()}
			>
				<IconDeviceFloppy class="size-4 shrink-0" />
				<span>{isSaving ? m.common_loading() : saveLabel}</span>
			</button>
		</div>
	{/if}
</div>
