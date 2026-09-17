<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		IconArrowLeft,
		IconDeviceFloppy,
		IconDoor,
		IconHash,
		IconRefresh,
		IconTag,
		IconTrash,
		IconUser
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import {
		getResidentialUnitStatusOptions,
		getResidentialUnitTypeOptions
	} from '$lib/remote/address/attribute-options.remote';
	import {
		deleteResidentialUnit,
		getResidentialUnit,
		regenerateResidentialUnitId,
		updateResidentialUnit
	} from '$lib/remote/address/residential-units.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	let {
		unitUuid,
		addressUuid,
		projectId
	}: { unitUuid: string; addressUuid: string; projectId: string } = $props();

	// The form edits a snapshot of the unit; the parent re-keys this
	// component per unit, so the loads below run once per unit.
	// svelte-ignore state_referenced_locally
	const [unit, residentialUnitTypes, residentialUnitStatuses] = await Promise.all([
		getResidentialUnit(unitUuid),
		getResidentialUnitTypeOptions(),
		getResidentialUnitStatusOptions()
	]);

	let formIdResidentialUnit = $state(unit.id_residential_unit ?? '');
	let formFloor = $state<number | ''>(unit.floor ?? '');
	let formSide = $state(unit.side ?? '');
	let formBuildingSection = $state(unit.building_section ?? '');
	let formTypeId = $state<string | number>(unit.residential_unit_type?.id ?? '');
	let formStatusId = $state<string | number>(unit.status?.id ?? '');
	let formExternalId1 = $state(unit.external_id_1 ?? '');
	let formExternalId2 = $state(unit.external_id_2 ?? '');
	let formResidentName = $state(unit.resident_name ?? '');
	let formResidentRecordedDate = $state(unit.resident_recorded_date ?? '');
	let formReadyForService = $state(unit.ready_for_service ?? '');

	let isSaving = $state(false);
	let isDeleting = $state(false);
	let isRegenerating = $state(false);
	let deleteMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);
	let regenerateMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);

	const displayTitle = $derived.by(() => {
		if (formIdResidentialUnit) return formIdResidentialUnit;
		if (formFloor !== '' || formSide) {
			const parts = [];
			if (formFloor !== '') parts.push(`${m.form_floor()} ${formFloor}`);
			if (formSide) parts.push(formSide);
			return parts.join(' - ');
		}
		return m.section_residential_units({ count: 2 });
	});

	/**
	 * Reports a failed write: console, backend log, and an error toast that
	 * prefers the backend's message.
	 * @param error - The rejection value.
	 * @param from - Handler name for the backend log.
	 * @param fallback - Toast text when the error carries no message.
	 */
	function reportError(error: unknown, from: string, fallback: string) {
		console.error(fallback, error);
		void logToBackendClient({
			level: 'ERROR',
			message: fallback,
			extraData: {
				from,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			}
		});
		globalToaster.error({
			title: m.common_error(),
			description: remoteErrorMessage(error) ?? fallback
		});
	}

	/**
	 * Saves the form and takes the backend-normalised id back into the form.
	 */
	async function handleSave() {
		isSaving = true;
		try {
			const updated = await updateResidentialUnit({
				unitUuid,
				id_residential_unit: formIdResidentialUnit,
				floor: formFloor === '' ? null : Number(formFloor),
				side: formSide,
				building_section: formBuildingSection,
				residential_unit_type_id: Number(formTypeId) || null,
				status_id: Number(formStatusId) || null,
				external_id_1: formExternalId1,
				external_id_2: formExternalId2,
				resident_name: formResidentName,
				resident_recorded_date: formResidentRecordedDate,
				ready_for_service: formReadyForService
			});
			formIdResidentialUnit = updated.id_residential_unit ?? '';
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_residential_unit()
			});
		} catch (error) {
			reportError(
				error,
				'ResidentialUnitForm.handleSave',
				m.message_error_updating_residential_unit()
			);
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Deletes the unit and returns to its address.
	 */
	async function handleDelete() {
		isDeleting = true;
		try {
			await deleteResidentialUnit({ unitUuid, addressUuid });
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_residential_unit()
			});
			await goto(`/address/${projectId}/${addressUuid}`);
		} catch (error) {
			reportError(
				error,
				'ResidentialUnitForm.handleDelete',
				m.message_error_deleting_residential_unit()
			);
		} finally {
			isDeleting = false;
		}
	}

	/**
	 * Asks the backend for a fresh unit id and shows it in the form.
	 */
	async function handleRegenerateId() {
		isRegenerating = true;
		try {
			const updated = await regenerateResidentialUnitId(unitUuid);
			formIdResidentialUnit = updated.id_residential_unit ?? '';
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_regenerating_residential_unit_id()
			});
		} catch (error) {
			reportError(
				error,
				'ResidentialUnitForm.handleRegenerateId',
				m.message_error_regenerating_residential_unit_id()
			);
		} finally {
			isRegenerating = false;
		}
	}

	function goBack() {
		goto(`/address/${projectId}/${addressUuid}`);
	}
</script>

<svelte:head>
	<title>{displayTitle} - {m.section_residential_units({ count: 1 })}</title>
</svelte:head>

{#snippet actionButtons(extraClass: string)}
	<button
		onclick={() => deleteMessageBox?.open()}
		class={['btn preset-filled-error-500 inline-flex items-center gap-2', extraClass]}
		disabled={isDeleting}
	>
		<IconTrash class="size-4 shrink-0" />
		<span class="hidden sm:inline">{m.action_delete()}</span>
	</button>
	<button
		onclick={handleSave}
		class={['btn preset-filled-primary-500 inline-flex items-center gap-2', extraClass]}
		disabled={isSaving}
	>
		{#if isSaving}
			<span>{m.common_loading()}</span>
		{:else}
			<IconDeviceFloppy class="size-4 shrink-0" />
			<span>{m.common_save()}</span>
		{/if}
	</button>
{/snippet}

<div class="space-y-4 sm:space-y-6">
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
				{@render actionButtons('')}
			</div>
		</div>
		<div class="flex sm:hidden items-center gap-2">
			{@render actionButtons('flex-1')}
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
		<div class="card p-4 sm:p-6 space-y-4">
			<div class="flex items-center gap-3">
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
						onclick={() => regenerateMessageBox?.open()}
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
						<input
							id="external-id-1"
							type="text"
							class="input"
							name="external_id_1"
							bind:value={formExternalId1}
						/>
					</label>
					<label class="label">
						<span class="label-text text-sm text-surface-900-100">{m.form_external_id_2()}</span>
						<input
							id="external-id-2"
							type="text"
							class="input"
							name="external_id_2"
							bind:value={formExternalId2}
						/>
					</label>
				</div>
			</div>
		</div>

		<div class="card p-4 sm:p-6 space-y-4">
			<div class="flex items-center gap-3">
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
						onValueChange={(e: { value: string[] }) => {
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
						onValueChange={(e: { value: string[] }) => {
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
				<IconUser class="size-5 text-warning-500" />
				<h2 class="text-lg font-semibold">{m.from_resident()}</h2>
			</div>

			<div class="space-y-4">
				<label class="label">
					<span class="label-text text-sm text-surface-900-100">{m.form_resident_name()}</span>
					<input
						id="resident-name"
						type="text"
						class="input"
						name="resident_name"
						bind:value={formResidentName}
					/>
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
					<span class="label-text text-sm text-surface-900-100">{m.form_ready_for_service()}</span>
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
</div>

<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm_delete()}
	message={m.message_confirm_delete_residential_unit()}
	showAcceptButton={true}
	acceptText={m.action_delete()}
	closeText={m.common_cancel()}
	onAccept={handleDelete}
/>

<MessageBox
	bind:this={regenerateMessageBox}
	heading={m.common_confirm()}
	message={m.message_confirm_regenerate_residential_unit_id()}
	showAcceptButton={true}
	acceptText={m.action_regenerate_id()}
	closeText={m.common_cancel()}
	onAccept={handleRegenerateId}
/>
