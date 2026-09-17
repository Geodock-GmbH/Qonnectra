<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		IconArrowLeft,
		IconBuilding,
		IconDeviceFloppy,
		IconHome,
		IconRefresh,
		IconTrash
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import {
		deleteAddress,
		getAddress,
		getAddressLinks,
		regenerateAddressId,
		updateAddress
	} from '$lib/remote/address/addresses.remote';
	import {
		getFlagOptions,
		getStatusDevelopmentOptions
	} from '$lib/remote/address/attribute-options.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	let { uuid, projectId }: { uuid: string; projectId: string } = $props();

	// The form edits a snapshot of the address; the parent re-keys this
	// component per uuid, so the loads below run once per address.
	// svelte-ignore state_referenced_locally
	const [address, links, statusDevelopments, flags] = await Promise.all([
		getAddress(uuid),
		getAddressLinks(uuid),
		getStatusDevelopmentOptions(),
		getFlagOptions()
	]);

	const isLinkedToNode = links.nodes.length > 0;
	const project = address.project?.project ?? '';

	let id_address = $state(address.id_address);
	let id_address_2 = $state(address.id_address_2 ?? '');
	let street = $state(address.street);
	let housenumber = $state<number | ''>(address.housenumber ?? '');
	let house_number_suffix = $state(address.house_number_suffix);
	let zip_code = $state(address.zip_code);
	let city = $state(address.city);
	let district = $state(address.district);
	let status_development_id = $state<string | number>(address.status_development?.id ?? '');
	let flag_id = $state<string | number>(address.flag?.id ?? '');

	let isSaving = $state(false);
	let isDeleting = $state(false);
	let isRegenerating = $state(false);
	let deleteMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);
	let regenerateMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);

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
	 * Saves the form and takes the backend-normalised ids back into the form.
	 */
	async function handleSave() {
		isSaving = true;
		try {
			const updated = await updateAddress({
				uuid,
				street,
				housenumber: housenumber === '' ? null : Number(housenumber),
				house_number_suffix,
				zip_code,
				city,
				district,
				status_development_id: Number(status_development_id) || null,
				flag_id: Number(flag_id) || null,
				id_address,
				id_address_2
			});
			id_address = updated.id_address;
			id_address_2 = updated.id_address_2 ?? '';
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_address()
			});
		} catch (error) {
			reportError(error, 'AddressForm.handleSave', m.message_error_updating_address());
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Deletes the address and returns to the project's address list.
	 */
	async function handleDelete() {
		isDeleting = true;
		try {
			await deleteAddress(uuid);
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_address()
			});
			await goto(`/address/${projectId}`);
		} catch (error) {
			reportError(error, 'AddressForm.handleDelete', m.message_error_deleting_address());
		} finally {
			isDeleting = false;
		}
	}

	/**
	 * Asks the backend for a fresh address id and shows it in the form.
	 */
	async function handleRegenerateId() {
		isRegenerating = true;
		try {
			const updated = await regenerateAddressId(uuid);
			id_address = updated.id_address;
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_regenerating_id()
			});
		} catch (error) {
			reportError(error, 'AddressForm.handleRegenerateId', m.message_error_regenerating_id());
		} finally {
			isRegenerating = false;
		}
	}

	function goBack() {
		goto(`/address/${projectId}`);
	}
</script>

<svelte:head>
	<title>{street} {housenumber}{house_number_suffix} - {m.nav_address()}</title>
</svelte:head>

{#snippet actionButtons(extraClass: string)}
	<button
		onclick={() => deleteMessageBox?.open()}
		class={['btn preset-filled-error-500 inline-flex items-center gap-2', extraClass]}
		disabled={isDeleting || isLinkedToNode}
		{@attach tooltip(m.message_address_linked_to_node(), { disabled: !isLinkedToNode })}
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

<div class="contents">
	<div class="card p-3 sm:p-4 space-y-3 sm:space-y-0 lg:col-span-5">
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
						<IconHome class="size-4 sm:size-5 text-primary-500" />
					</div>
					<div class="min-w-0">
						<h1 class="text-lg sm:text-2xl font-bold truncate">
							{street}
							{housenumber}{house_number_suffix}
						</h1>
						<p class="text-xs sm:text-sm text-surface-900-100 truncate">
							{zip_code}
							{city}{district ? ` · ${district}` : ''}
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

	<div class="lg:col-span-3 card p-4 sm:p-6 space-y-4 sm:space-y-6">
		<div class="flex items-center gap-3">
			<IconHome class="size-5 text-primary-500" />
			<h2 class="text-lg font-semibold">{m.section_address_information()}</h2>
		</div>

		<div class="space-y-4">
			<div class="flex items-end gap-3">
				<label class="label flex-1">
					<span class="label-text text-sm text-surface-900-100"
						>{m.form_id_address({ count: 1 })}</span
					>
					<input
						id="id-address"
						type="text"
						class="input"
						maxlength="7"
						name="id_address"
						bind:value={id_address}
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

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_id_address_2()}</span>
				<input
					id="id-address-2"
					type="text"
					class="input"
					maxlength="7"
					name="id_address_2"
					bind:value={id_address_2}
					{@attach tooltip(m.tooltip_id_address_2(), { position: 'bottom', delay: 1000 })}
				/>
			</label>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100"
					>{m.form_street()} <span class="text-error-400">*</span></span
				>
				<input id="street" type="text" class="input" name="street" bind:value={street} />
			</label>

			<div class="grid grid-cols-2 gap-4">
				<label class="label">
					<span class="label-text text-sm text-surface-900-100"
						>{m.form_housenumber()} <span class="text-error-400">*</span></span
					>
					<input
						id="housenumber"
						type="number"
						class="input"
						name="housenumber"
						bind:value={housenumber}
					/>
				</label>
				<label class="label">
					<span class="label-text text-sm text-surface-900-100">{m.form_house_number_suffix()}</span
					>
					<input
						id="house-number-suffix"
						type="text"
						class="input"
						name="house_number_suffix"
						bind:value={house_number_suffix}
					/>
				</label>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<label class="label">
					<span class="label-text text-sm text-surface-900-100"
						>{m.form_zip_code()} <span class="text-error-400">*</span></span
					>
					<input id="zip-code" type="text" class="input" name="zip_code" bind:value={zip_code} />
				</label>
				<label class="label">
					<span class="label-text text-sm text-surface-900-100"
						>{m.form_city()} <span class="text-error-400">*</span></span
					>
					<input id="city" type="text" class="input" name="city" bind:value={city} />
				</label>
			</div>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_district()}</span>
				<input id="district" type="text" class="input" name="district" bind:value={district} />
			</label>

			<div class="border-t border-surface-200-800"></div>

			<div class="flex items-center gap-3 pt-1">
				<IconBuilding class="size-5 text-tertiary-500" />
				<h2 class="text-lg font-semibold">{m.section_classification()}</h2>
			</div>

			<div class="label">
				<span class="label-text text-sm text-surface-900-100">{m.form_status_development()}</span>
				<GenericCombobox
					data={statusDevelopments}
					value={status_development_id ? [status_development_id] : []}
					placeholder="-"
					onValueChange={(e: { value: string[] }) => {
						status_development_id = e.value[0] || '';
					}}
				/>
			</div>

			<div class="label">
				<span class="label-text text-sm text-surface-900-100"
					>{m.form_flag()} <span class="text-error-400">*</span></span
				>
				<GenericCombobox
					data={flags}
					value={flag_id ? [flag_id] : []}
					placeholder="-"
					required={true}
					onValueChange={(e: { value: string[] }) => {
						flag_id = e.value[0] || '';
					}}
				/>
			</div>

			<label class="label">
				<span class="label-text text-sm text-surface-900-100"
					>{m.form_project({ count: 1 })} <span class="text-error-400">*</span></span
				>
				<input
					id="project"
					type="text"
					class="input bg-surface-50-950 cursor-default opacity-60"
					name="project"
					value={project}
					readonly
				/>
			</label>
		</div>
	</div>
</div>

<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm_delete()}
	message={m.message_confirm_delete_address()}
	showAcceptButton={true}
	acceptText={m.action_delete()}
	closeText={m.common_cancel()}
	onAccept={handleDelete}
/>

<MessageBox
	bind:this={regenerateMessageBox}
	heading={m.common_confirm()}
	message={m.message_confirm_regenerate_id()}
	showAcceptButton={true}
	acceptText={m.action_regenerate_id()}
	closeText={m.common_cancel()}
	onAccept={handleRegenerateId}
/>
