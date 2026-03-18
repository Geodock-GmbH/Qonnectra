<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		IconArrowLeft,
		IconDeviceFloppy,
		IconDoor,
		IconFolder,
		IconHash,
		IconLink,
		IconRefresh,
		IconTag,
		IconTrash,
		IconUser
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	let { data } = $props();

	let isSaving = $state(false);
	let isDeleting = $state(false);
	let isRegenerating = $state(false);

	const unit = $derived(data.unit);
	const unitError = $derived(data.unitError);
	const projectId = $derived(data.projectId);
	const addressUuid = $derived(data.addressUuid);
	const residentialUnitTypes = $derived(data.residentialUnitTypes || []);
	const residentialUnitStatuses = $derived(data.residentialUnitStatuses || []);
	const fiberConnections = $derived(data.fiberConnections || []);

	/**
	 * Snapshots the unit from initial page data to avoid reactivity on form fields.
	 * @returns {Object | null} The residential unit object.
	 */
	function getInitialUnit() {
		return data.unit;
	}
	const initialUnit = /** @type {any} */ (getInitialUnit());

	let formIdResidentialUnit = $state(initialUnit?.id_residential_unit || '');
	let formFloor = $state(initialUnit?.floor ?? '');
	let formSide = $state(initialUnit?.side || '');
	let formBuildingSection = $state(initialUnit?.building_section || '');
	let formTypeId = $state(initialUnit?.residential_unit_type?.id || '');
	let formStatusId = $state(initialUnit?.status?.id || '');
	let formExternalId1 = $state(initialUnit?.external_id_1 || '');
	let formExternalId2 = $state(initialUnit?.external_id_2 || '');
	let formResidentName = $state(initialUnit?.resident_name || '');
	let formResidentRecordedDate = $state(initialUnit?.resident_recorded_date || '');
	let formReadyForService = $state(initialUnit?.ready_for_service || '');

	/** @type {any} */
	let deleteMessageBox = $state(null);
	/** @type {any} */
	let fileExplorer = $state(null);

	const featureId = $derived(unit?.uuid);

	const displayTitle = $derived.by(() => {
		if (formIdResidentialUnit) return formIdResidentialUnit;
		if (formFloor || formSide) {
			const parts = [];
			if (formFloor) parts.push(`${m.form_floor()} ${formFloor}`);
			if (formSide) parts.push(formSide);
			return parts.join(' - ');
		}
		return m.section_residential_units({ count: 2 });
	});

	/**
	 * Submits form data to the updateResidentialUnit action and shows a toast on result.
	 */
	async function handleSave() {
		isSaving = true;
		const formData = new FormData();

		formData.append('id_residential_unit', formIdResidentialUnit);
		formData.append('floor', formFloor.toString());
		formData.append('side', formSide);
		formData.append('building_section', formBuildingSection);
		if (formTypeId) formData.append('residential_unit_type_id', formTypeId.toString());
		if (formStatusId) formData.append('status_id', formStatusId.toString());
		formData.append('external_id_1', formExternalId1);
		formData.append('external_id_2', formExternalId2);
		formData.append('resident_name', formResidentName);
		formData.append('resident_recorded_date', formResidentRecordedDate);
		formData.append('ready_for_service', formReadyForService);

		try {
			const response = await fetch('?/updateResidentialUnit', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				const updated = /** @type {any} */ (result.data)?.unit;
				if (updated?.id_residential_unit != null) {
					formIdResidentialUnit = updated.id_residential_unit;
				}
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_updating_residential_unit()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_error_updating_residential_unit()
				});
			}
		} catch (error) {
			console.error('Error updating residential unit:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_residential_unit()
			});
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Submits the deleteResidentialUnit action and redirects on success.
	 */
	async function handleDelete() {
		isDeleting = true;
		const formData = new FormData();

		try {
			const response = await fetch('?/deleteResidentialUnit', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'redirect') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_deleting_residential_unit()
				});
				goto(result.location);
			} else if (result.type === 'failure') {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_error_deleting_residential_unit()
				});
			}
		} catch (error) {
			console.error('Error deleting residential unit:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_residential_unit()
			});
		} finally {
			isDeleting = false;
		}
	}

	/**
	 * Triggers backend ID regeneration and updates the local form state.
	 */
	async function handleRegenerateId() {
		isRegenerating = true;
		const formData = new FormData();

		try {
			const response = await fetch('?/regenerateId', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				formIdResidentialUnit = /** @type {any} */ (result.data).id_residential_unit;
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_regenerating_residential_unit_id()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message ||
						m.message_error_regenerating_residential_unit_id()
				});
			}
		} catch (error) {
			console.error('Error regenerating residential unit ID:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_regenerating_residential_unit_id()
			});
		} finally {
			isRegenerating = false;
		}
	}

	function handleUploadComplete() {
		fileExplorer?.refresh();
	}

	function openDeleteConfirm() {
		deleteMessageBox?.open();
	}

	function goBack() {
		goto(`/address/${projectId}/${addressUuid}`);
	}
</script>

<svelte:head>
	<title>{displayTitle} - {m.section_residential_units({ count: 1 })}</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-4 sm:space-y-6">
	<div class="card p-3 sm:p-4 space-y-3 sm:space-y-0">
		<div class="flex items-center justify-between gap-2 sm:gap-4">
			<div class="flex items-center gap-2 sm:gap-4 min-w-0">
				<button
					onclick={goBack}
					class="btn preset-tonal-primary inline-flex items-center gap-2 shrink-0"
				>
					<IconArrowLeft class="size-4 shrink-0" />
					<span class="hidden sm:inline">{m.common_back()}</span>
				</button>
				<div class="flex items-center gap-2 sm:gap-3 min-w-0">
					<div
						class="size-8 sm:size-10 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0"
					>
						<IconDoor class="size-4 sm:size-5 text-primary-500" />
					</div>
					<div class="min-w-0">
						<h1 class="text-lg sm:text-2xl font-bold truncate">
							{displayTitle}
						</h1>
						<p class="text-xs sm:text-sm text-surface-900-100">
							{m.section_residential_units({ count: 1 })}
						</p>
					</div>
				</div>
			</div>
			<div class="hidden sm:flex items-center gap-2 shrink-0">
				<button
					onclick={openDeleteConfirm}
					class="btn preset-filled-error-500 inline-flex items-center gap-2"
					disabled={isDeleting}
				>
					<IconTrash class="size-4 shrink-0" />
					<span class="hidden sm:inline">{m.action_delete()}</span>
				</button>
				<button
					onclick={handleSave}
					class="btn preset-filled-primary-500 inline-flex items-center gap-2"
					disabled={isSaving}
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
		<!-- Mobile action buttons -->
		<div class="flex sm:hidden items-center gap-2">
			<button
				onclick={openDeleteConfirm}
				class="btn preset-filled-error-500 inline-flex items-center gap-2 flex-1"
				disabled={isDeleting}
			>
				<IconTrash class="size-4 shrink-0" />
				<span>{m.action_delete()}</span>
			</button>
			<button
				onclick={handleSave}
				class="btn preset-filled-primary-500 inline-flex items-center gap-2 flex-1"
				disabled={isSaving}
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

	{#if unitError}
		<div class="card preset-filled-error-500 p-4">
			<p>{unitError}</p>
		</div>
	{:else if unit}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
			<div class="card p-4 sm:p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-primary-500"></div>
					<IconHash class="size-5 text-primary-500" />
					<h2 class="text-lg font-semibold">{m.form_id_residential_unit()}</h2>
				</div>

				<div class="space-y-4">
					<div class="flex items-end gap-3">
						<label class="label flex-1">
							<span class="label-text text-sm text-surface-900-100"
								>{m.form_id_residential_unit()}</span
							>
							<input
								id="id-residential-unit"
								type="text"
								class="input"
								maxlength="8"
								name="id_residential_unit"
								bind:value={formIdResidentialUnit}
							/>
						</label>
						<button
							onclick={handleRegenerateId}
							class="btn preset-tonal-primary inline-flex items-center gap-2"
							disabled={isRegenerating}
						>
							{#if isRegenerating}
								<span>{m.common_loading()}</span>
							{:else}
								<IconRefresh class="size-4 shrink-0" />
								<span class="hidden sm:inline">{m.action_regenerate_id()}</span>
							{/if}
						</button>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span class="label-text text-sm text-surface-900-100">{m.form_external_id_1()}</span>
							<input id="external-id-1" type="text" class="input" name="external_id_1" bind:value={formExternalId1} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-900-100">{m.form_external_id_2()}</span>
							<input id="external-id-2" type="text" class="input" name="external_id_2" bind:value={formExternalId2} />
						</label>
					</div>
				</div>
			</div>

			<div class="card p-4 sm:p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-tertiary-500"></div>
					<IconTag class="size-5 text-tertiary-500" />
					<h2 class="text-lg font-semibold">{m.section_classification()}</h2>
				</div>

				<div class="space-y-4">
					<div class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_residential_unit_type()}</span
						>
						<GenericCombobox
							data={residentialUnitTypes}
							value={formTypeId ? [formTypeId] : []}
							placeholder="-"
							onValueChange={(/** @type {{ value: string[] }} */ e) => {
								formTypeId = e.value[0] || '';
							}}
						/>
					</div>
					<div class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_residential_unit_status()}</span
						>
						<GenericCombobox
							data={residentialUnitStatuses}
							value={formStatusId ? [formStatusId] : []}
							placeholder="-"
							onValueChange={(/** @type {{ value: string[] }} */ e) => {
								formStatusId = e.value[0] || '';
							}}
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
			<div class="card p-4 sm:p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-secondary-500"></div>
					<IconDoor class="size-5 text-secondary-500" />
					<h2 class="text-lg font-semibold">{m.section_location()}</h2>
				</div>

				<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_floor()}</span>
						<input id="unit-floor" type="number" class="input" name="floor" bind:value={formFloor} />
					</label>
					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_residential_unit_side()}</span
						>
						<input id="unit-side" type="text" class="input" name="side" bind:value={formSide} />
					</label>
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_building_section()}</span>
						<input
							id="unit-building-section"
							type="text"
							class="input"
							name="building_section"
							bind:value={formBuildingSection}
						/>
					</label>
				</div>
			</div>

			<div class="card p-4 sm:p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-warning-500"></div>
					<IconUser class="size-5 text-warning-500" />
					<h2 class="text-lg font-semibold">{m.from_resident()}</h2>
				</div>

				<div class="space-y-4">
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_resident_name()}</span>
						<input id="resident-name" type="text" class="input" name="resident_name" bind:value={formResidentName} />
					</label>

					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_resident_recorded_date()}</span
						>
						<input
							id="resident-recorded-date"
							type="date"
							class="input"
							name="resident_recorded_date"
							bind:value={formResidentRecordedDate}
						/>
					</label>
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_ready_for_service()}</span
						>
						<input
							id="ready-for-service"
							type="date"
							class="input"
							name="ready_for_service"
							bind:value={formReadyForService}
						/>
					</label>
				</div>
			</div>
		</div>

		<!-- Fiber Connections -->
		<div class="card p-4 sm:p-6 space-y-4">
			<div class="flex items-center gap-3">
				<div class="w-1 h-6 rounded-full bg-warning-500"></div>
				<IconLink class="size-5 text-warning-500" />
				<h2 class="text-lg font-semibold">{m.section_fiber_connections()}</h2>
				{#if fiberConnections.length > 0}
					<span class="badge preset-tonal-primary text-xs ml-auto">{fiberConnections.length}</span>
				{/if}
			</div>

			{#if fiberConnections.length > 0}
				<!-- Desktop table -->
				<div class="hidden md:block overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_node()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_cable_name()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_fiber_absolute()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_bundle()}</th
								>
								<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider"
									>{m.table_fiber()}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each fiberConnections as fc, i (i)}
								<tr class="hover:preset-tonal-primary transition-colors">
									<td class="font-medium">{fc.node_name}</td>
									<td>{fc.cable_name}</td>
									<td>
										<span
											class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
										>
											{fc.fiber_number_absolute}
										</span>
									</td>
									<td>
										<span class="inline-flex items-center gap-2">
											<span
												class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
											>
												{fc.bundle_number}
											</span>
											<span
												class="size-3 rounded-full border border-surface-300-700"
												style="background-color: {fc.bundle_color_hex || '#999999'}"
											></span>
											{fc.bundle_color}
										</span>
									</td>
									<td>
										<span class="inline-flex items-center gap-2">
											<span
												class="inline-flex items-center justify-center size-7 rounded-md bg-surface-200-800 text-xs font-mono font-medium"
											>
												{fc.fiber_number}
											</span>
											<span
												class="size-3 rounded-full border border-surface-300-700"
												style="background-color: {fc.fiber_color_hex || '#999999'}"
											></span>
											{fc.fiber_color}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<!-- Mobile cards -->
				<div class="md:hidden space-y-3">
					{#each fiberConnections as fc, i (i)}
						<div class="rounded-lg border border-surface-200-800 p-3 space-y-2">
							<div class="flex items-center justify-between">
								<span class="font-medium text-sm">{fc.node_name}</span>
								<span class="text-xs text-surface-900-100">{fc.cable_name}</span>
							</div>
							<div class="flex items-center gap-3 text-xs">
								<span class="inline-flex items-center gap-1">
									{m.table_fiber_absolute()}:
									<span
										class="inline-flex items-center justify-center size-6 rounded-md bg-surface-200-800 font-mono font-medium"
									>
										{fc.fiber_number_absolute}
									</span>
								</span>
							</div>
							<div class="flex items-center gap-4 text-xs">
								<span class="inline-flex items-center gap-1.5">
									{m.table_bundle()}:
									<span
										class="inline-flex items-center justify-center size-6 rounded-md bg-surface-200-800 font-mono font-medium"
									>
										{fc.bundle_number}
									</span>
									<span
										class="size-3 rounded-full border border-surface-300-700"
										style="background-color: {fc.bundle_color_hex || '#999999'}"
									></span>
									{fc.bundle_color}
								</span>
								<span class="inline-flex items-center gap-1.5">
									{m.table_fiber()}:
									<span
										class="inline-flex items-center justify-center size-6 rounded-md bg-surface-200-800 font-mono font-medium"
									>
										{fc.fiber_number}
									</span>
									<span
										class="size-3 rounded-full border border-surface-300-700"
										style="background-color: {fc.fiber_color_hex || '#999999'}"
									></span>
									{fc.fiber_color}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="rounded-lg border border-dashed border-surface-300-700 p-8 text-center">
					<IconLink class="size-10 mx-auto mb-3 text-warning-500 opacity-40" />
					<p class="text-sm font-medium text-surface-900-100">
						{m.message_no_fiber_connections()}
					</p>
				</div>
			{/if}
		</div>

		<div class="card p-4 sm:p-6 space-y-4">
			<div class="flex items-center gap-3">
				<div class="w-1 h-6 rounded-full bg-success-500"></div>
				<IconFolder class="size-5 text-success-500" />
				<h2 class="text-lg font-semibold">{m.form_attachments()}</h2>
			</div>

			{#if featureId}
				<FileUpload
					featureType="residentialunit"
					{featureId}
					onUploadComplete={handleUploadComplete}
				/>
				<FileExplorer bind:this={fileExplorer} featureType="residentialunit" {featureId} />
			{/if}
		</div>
	{/if}
</div>

<!-- Delete Confirmation -->
<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm_delete()}
	message={m.message_confirm_delete_residential_unit()}
	showAcceptButton={true}
	acceptText={m.action_delete()}
	closeText={m.common_cancel()}
	onAccept={handleDelete}
/>
