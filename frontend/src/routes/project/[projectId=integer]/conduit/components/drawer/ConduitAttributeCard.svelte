<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import {
		getCompanyOptions,
		getConduitTypeOptions,
		getFlagOptions,
		getNetworkLevelOptions,
		getStatusOptions
	} from '$lib/remote/conduit/attribute-options.remote';
	import {
		deleteConduit,
		getConduit,
		getConduitList,
		updateConduit
	} from '$lib/remote/conduit/conduits.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	let { uuid }: { uuid: string } = $props();

	// The form edits a snapshot of the conduit; the drawer tabs re-key this
	// component per uuid, so the loads below run once per conduit.
	// svelte-ignore state_referenced_locally
	const [conduit, conduitTypes, statuses, networkLevels, companies, flags] = await Promise.all([
		getConduit(uuid),
		getConduitTypeOptions(),
		getStatusOptions(),
		getNetworkLevelOptions(),
		getCompanyOptions(),
		getFlagOptions()
	]);

	/**
	 * The combobox selection for a reference: its id as a one-element array.
	 * @param ref - The expanded reference, if set.
	 */
	function selectionOf(ref: { id: number } | null | undefined): string[] {
		return ref?.id != null ? [String(ref.id)] : [];
	}

	/**
	 * The numeric id behind a combobox selection, if any.
	 * @param selection - The combobox value array.
	 */
	function idOf(selection: string[]): number | undefined {
		return Number(selection[0]) || undefined;
	}

	let messageBoxConfirm = $state<ReturnType<typeof MessageBox> | null>(null);

	let conduitName = $state(conduit.name ?? '');
	let conduitOuterConduit = $state(conduit.outer_conduit ?? '');
	let conduitType = $state(selectionOf(conduit.conduit_type));
	let conduitStatus = $state(selectionOf(conduit.status));
	let conduitNetworkLevel = $state(selectionOf(conduit.network_level));
	let conduitOwner = $state(selectionOf(conduit.owner));
	let conduitConstructor = $state(selectionOf(conduit.constructor));
	let conduitManufacturer = $state(selectionOf(conduit.manufacturer));
	let conduitDate = $state(conduit.date ?? '');
	let conduitFlag = $state(selectionOf(conduit.flag));

	/**
	 * Saves the form; the command pushes the result into `getConduit` and
	 * refreshes the list in the same flight.
	 * @param event
	 */
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		try {
			const updated = await updateConduit({
				uuid,
				name: conduitName,
				outer_conduit: conduitOuterConduit,
				date: conduitDate || undefined,
				conduit_type_id: idOf(conduitType),
				status_id: idOf(conduitStatus),
				network_level_id: idOf(conduitNetworkLevel),
				owner_id: idOf(conduitOwner),
				constructor_id: idOf(conduitConstructor),
				manufacturer_id: idOf(conduitManufacturer),
				flag_id: idOf(conduitFlag)
			}).updates(getConduitList);

			drawerStore.setTitle(updated.name);
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_conduit()
			});
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_error_updating_conduit()
			});
		}
	}

	function confirmDelete() {
		messageBoxConfirm?.open();
	}

	/**
	 * Deletes the conduit, refreshes the list and closes the drawer.
	 */
	async function handleDelete() {
		try {
			await deleteConduit(uuid).updates(getConduitList);
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_conduit()
			});
			drawerStore.close();
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_error_deleting_conduit()
			});
		}
	}
</script>

<form id="conduit-form" class="flex flex-col gap-4 mr-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="text-sm">{m.common_name()}</span>
		<input
			type="text"
			class="input"
			placeholder=""
			name="conduit_name"
			required
			bind:value={conduitName}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_conduit_type()}</span>
		<GenericCombobox data={conduitTypes} bind:value={conduitType} renderInPlace={true} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_outer_conduit()}</span>
		<textarea name="outer_conduit" class="textarea" placeholder="" bind:value={conduitOuterConduit}
		></textarea>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox data={statuses} bind:value={conduitStatus} renderInPlace={true} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox data={networkLevels} bind:value={conduitNetworkLevel} renderInPlace={true} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox data={companies} bind:value={conduitOwner} renderInPlace={true} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox data={companies} bind:value={conduitConstructor} renderInPlace={true} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox data={companies} bind:value={conduitManufacturer} renderInPlace={true} />
	</label>
	<label class="label">
		<span class="text-sm">{m.common_date()}</span>
		<input type="date" class="input" name="date" bind:value={conduitDate} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox data={flags} bind:value={conduitFlag} renderInPlace={true} />
	</label>
</form>

<div
	class="sticky bottom-0 mt-6 mr-4 flex flex-col items-end justify-end gap-3 bg-surface-50-950 pb-2 pt-4"
>
	<button type="submit" form="conduit-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
	<button type="button" onclick={confirmDelete} class="btn preset-filled-error-500 w-full">
		{m.action_delete_conduit()}
	</button>
</div>

<MessageBox
	bind:this={messageBoxConfirm}
	heading={m.common_confirm()}
	message={m.message_confirm_delete_conduit()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={handleDelete}
/>
