<script>
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconPlus } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	let {
		residentialUnitTypes = [],
		residentialUnitStatuses = [],
		openModal = $bindable(false)
	} = $props();

	let formIdResidentialUnit = $state('');
	let formFloor = $state('');
	let formSide = $state('');
	let formBuildingSection = $state('');
	let formExternalId1 = $state('');
	let formExternalId2 = $state('');
	let formTypeId = $state('');
	let formStatusId = $state('');

	function resetForm() {
		formIdResidentialUnit = '';
		formFloor = '';
		formSide = '';
		formBuildingSection = '';
		formExternalId1 = '';
		formExternalId2 = '';
		formTypeId = '';
		formStatusId = '';
	}

	function handleClose() {
		openModal = false;
		resetForm();
	}

	/**
	 * Submits the createResidentialUnit action and invalidates page data on success.
	 * @param {SubmitEvent} event
	 */
	async function handleSubmit(event) {
		event.preventDefault();

		const formData = new FormData();
		if (formIdResidentialUnit) formData.append('id_residential_unit', formIdResidentialUnit);
		if (formFloor) formData.append('floor', formFloor);
		if (formSide) formData.append('side', formSide);
		if (formBuildingSection) formData.append('building_section', formBuildingSection);
		if (formExternalId1) formData.append('external_id_1', formExternalId1);
		if (formExternalId2) formData.append('external_id_2', formExternalId2);
		if (formTypeId) formData.append('residential_unit_type_id', formTypeId);
		if (formStatusId) formData.append('status_id', formStatusId);

		try {
			const response = await fetch('?/createResidentialUnit', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_creating_residential_unit()
				});
				invalidateAll();
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: /** @type {any} */ (result).data?.message || m.message_error_creating_residential_unit()
				});
			}
		} catch (error) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_residential_unit()
			});
		}
	}
</script>

<Dialog
	open={openModal}
	onOpenChange={(e) => (openModal = e.open)}
	closeOnInteractOutside={true}
	closeOnEscape={true}
	onInteractOutside={resetForm}
	onEscapeKeyDown={resetForm}
>
	<Dialog.Trigger class="btn preset-filled-primary-500 btn-sm">
		<IconPlus class="size-4" />
		<span>{m.action_add()}</span>
	</Dialog.Trigger>

	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 backdrop-blur-sm" />

		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<Dialog.Content class="card bg-surface-100-900 p-6 space-y-5 shadow-xl w-full max-w-lg">
				<Dialog.Title>
					<h2 class="text-xl font-semibold">{m.action_add_residential_unit()}</h2>
				</Dialog.Title>

				<form id="residential-unit-form" class="space-y-4" onsubmit={handleSubmit}>
					<label class="label">
						<span class="label-text text-sm text-surface-600-400"
							>{m.form_id_residential_unit()}</span
						>
						<input
							type="text"
							class="input transition-colors"
							bind:value={formIdResidentialUnit}
							placeholder=""
							maxlength="8"
						/>
					</label>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-600-400">{m.form_floor()}</span>
							<input type="number" class="input transition-colors" bind:value={formFloor} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_residential_unit_side()}</span
							>
							<input type="text" class="input transition-colors" bind:value={formSide} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_building_section()}</span
							>
							<input type="text" class="input transition-colors" bind:value={formBuildingSection} />
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-600-400">{m.form_external_id_1()}</span>
							<input type="text" class="input transition-colors" bind:value={formExternalId1} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-600-400">{m.form_external_id_2()}</span>
							<input type="text" class="input transition-colors" bind:value={formExternalId2} />
						</label>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_residential_unit_type()}</span
							>
							<select class="select transition-colors" bind:value={formTypeId}>
								<option value="">-</option>
								{#each residentialUnitTypes as type (type.value)}
									<option value={type.value}>{type.label}</option>
								{/each}
							</select>
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-600-400"
								>{m.form_residential_unit_status()}</span
							>
							<select class="select transition-colors" bind:value={formStatusId}>
								<option value="">-</option>
								{#each residentialUnitStatuses as status (status.value)}
									<option value={status.value}>{status.label}</option>
								{/each}
							</select>
						</label>
					</div>
				</form>

				<footer class="flex justify-end gap-4">
					<button type="button" class="btn preset-outlined" onclick={handleClose}>
						{m.action_close()}
					</button>
					<button type="submit" class="btn preset-filled" form="residential-unit-form">
						{m.action_save()}
					</button>
				</footer>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
