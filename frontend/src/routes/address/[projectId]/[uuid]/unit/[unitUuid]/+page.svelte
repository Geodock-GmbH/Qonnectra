<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		IconArrowLeft,
		IconDeviceFloppy,
		IconDoor,
		IconFolder,
		IconHash,
		IconRefresh,
		IconTag,
		IconTrash,
		IconUser
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
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

	// Initialize form state from unit data
	function getInitialUnit() {
		return data.unit;
	}
	const initialUnit = getInitialUnit();

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

	let deleteMessageBox = $state(null);
	let fileExplorer = $state(null);

	const featureId = $derived(unit?.uuid);

	// Derive display title
	const displayTitle = $derived.by(() => {
		if (formIdResidentialUnit) return formIdResidentialUnit;
		if (formFloor || formSide) {
			const parts = [];
			if (formFloor) parts.push(`${m.form_floor()} ${formFloor}`);
			if (formSide) parts.push(formSide);
			return parts.join(' - ');
		}
		return m.section_residential_units();
	});

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
				const updated = result.data?.unit;
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
					description: result.data?.message || m.message_error_updating_residential_unit()
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
					description: result.data?.message || m.message_error_deleting_residential_unit()
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
				formIdResidentialUnit = result.data.id_residential_unit;
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_regenerating_residential_unit_id()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: result.data?.message || m.message_error_regenerating_residential_unit_id()
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
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}

	function openDeleteConfirm() {
		deleteMessageBox.open();
	}

	function goBack() {
		goto(`/address/${projectId}/${addressUuid}`);
	}
</script>

<svelte:head>
	<title>{displayTitle} - {m.section_residential_units({ count: 1 })}</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6">
	<!-- Header -->
	<div class="card p-4 flex items-center justify-between gap-4">
		<div class="flex items-center gap-4 min-w-0">
			<button
				onclick={goBack}
				class="btn preset-tonal-primary inline-flex items-center gap-2 shrink-0"
			>
				<IconArrowLeft class="size-4 shrink-0" />
				<span>{m.common_back()}</span>
			</button>
			<div class="flex items-center gap-3 min-w-0">
				<div class="size-10 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0">
					<IconDoor class="size-5 text-primary-500" />
				</div>
				<div class="min-w-0">
					<h1 class="text-2xl font-bold truncate">
						{displayTitle}
					</h1>
					<p class="text-sm text-surface-900-100">
						{m.section_residential_units({ count: 1 })}
					</p>
				</div>
			</div>
		</div>
		<div class="flex items-center gap-2 shrink-0">
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

	{#if unitError}
		<div class="card preset-filled-error-500 p-4">
			<p>{unitError}</p>
		</div>
	{:else if unit}
		<!-- Identification + Location Row -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Identification -->
			<div class="card p-6 space-y-4">
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
							<input type="text" class="input" name="external_id_1" bind:value={formExternalId1} />
						</label>
						<label class="label">
							<span class="label-text text-sm text-surface-900-100">{m.form_external_id_2()}</span>
							<input type="text" class="input" name="external_id_2" bind:value={formExternalId2} />
						</label>
					</div>
				</div>
			</div>

			<!-- Classification -->
			<div class="card p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-tertiary-500"></div>
					<IconTag class="size-5 text-tertiary-500" />
					<h2 class="text-lg font-semibold">{m.section_classification()}</h2>
				</div>

				<div class="space-y-4">
					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_residential_unit_type()}</span
						>
						<select class="select" name="residential_unit_type_id" bind:value={formTypeId}>
							<option value="">-</option>
							{#each residentialUnitTypes as type (type.value)}
								<option value={type.value}>{type.label}</option>
							{/each}
						</select>
					</label>
					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_residential_unit_status()}</span
						>
						<select class="select" name="status_id" bind:value={formStatusId}>
							<option value="">-</option>
							{#each residentialUnitStatuses as status (status.value)}
								<option value={status.value}>{status.label}</option>
							{/each}
						</select>
					</label>
				</div>
			</div>
		</div>

		<!-- Location + Resident Row -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Location -->
			<div class="card p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-secondary-500"></div>
					<IconDoor class="size-5 text-secondary-500" />
					<h2 class="text-lg font-semibold">{m.section_location()}</h2>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_floor()}</span>
						<input type="number" class="input" name="floor" bind:value={formFloor} />
					</label>
					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_residential_unit_side()}</span
						>
						<input type="text" class="input" name="side" bind:value={formSide} />
					</label>
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_building_section()}</span>
						<input
							type="text"
							class="input"
							name="building_section"
							bind:value={formBuildingSection}
						/>
					</label>
				</div>
			</div>

			<!-- Resident Information -->
			<div class="card p-6 space-y-4">
				<div class="flex items-center gap-3">
					<div class="w-1 h-6 rounded-full bg-warning-500"></div>
					<IconUser class="size-5 text-warning-500" />
					<h2 class="text-lg font-semibold">{m.from_resident()}</h2>
				</div>

				<div class="space-y-4">
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_resident_name()}</span>
						<input type="text" class="input" name="resident_name" bind:value={formResidentName} />
					</label>

					<label class="label">
						<span class="label-text text-sm text-surface-900-100"
							>{m.form_resident_recorded_date()}</span
						>
						<input
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
							type="date"
							class="input"
							name="ready_for_service"
							bind:value={formReadyForService}
						/>
					</label>
				</div>
			</div>
		</div>

		<!-- Files - Full Width -->
		<div class="card p-6 space-y-4">
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
