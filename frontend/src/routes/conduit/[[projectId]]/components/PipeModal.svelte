<script lang="ts">
	import type { ConduitFormDefaults } from '$lib/utils/conduitFormDefaults';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconPlus } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import {
		emptyConduitFormDefaults,
		loadConduitFormDefaults,
		saveConduitFormDefaults
	} from '$lib/utils/conduitFormDefaults';
	import {
		getCompanyOptions,
		getConduitTypeOptions,
		getFlagOptions,
		getNetworkLevelOptions,
		getStatusOptions
	} from '$lib/remote/conduit/attribute-options.remote';
	import { createConduit, getConduitList } from '$lib/remote/conduit/conduits.remote';
	import { remoteErrorMessage, remoteErrorStatus } from '$lib/remote/shared/remote-error';

	let {
		projectId,
		openPipeModal = $bindable(false),
		isHidden = false
	}: {
		projectId?: string;
		openPipeModal?: boolean;
		isHidden?: boolean;
	} = $props();

	const [conduitTypes, statuses, networkLevels, companies, flags] = await Promise.all([
		getConduitTypeOptions(),
		getStatusOptions(),
		getNetworkLevelOptions(),
		getCompanyOptions(),
		getFlagOptions()
	]);

	// Opening restores the last saved values; closing clears them.
	let values = $state<ConduitFormDefaults>(
		openPipeModal ? loadConduitFormDefaults() : emptyConduitFormDefaults()
	);

	/**
	 * The numeric id behind a combobox selection, if any.
	 * @param selection - The combobox value array.
	 */
	function idOf(selection: string[]): number | undefined {
		return Number(selection[0]) || undefined;
	}

	/**
	 * Creates the conduit and refreshes the visible list in the same flight.
	 * The dialog stays open with its values so several conduits can be
	 * entered in a row; the values become the defaults for the next one.
	 * @param event
	 */
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		try {
			await createConduit({
				projectId: Number(projectId) || undefined,
				name: values.conduitName,
				outer_conduit: values.outerConduit || undefined,
				date: values.date || undefined,
				conduit_type_id: idOf(values.conduitType),
				status_id: idOf(values.status),
				network_level_id: idOf(values.networkLevel),
				owner_id: idOf(values.owner),
				constructor_id: idOf(values.constructor),
				manufacturer_id: idOf(values.manufacturer),
				flag_id: idOf(values.flag)
			}).updates(getConduitList);

			saveConduitFormDefaults($state.snapshot(values));
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_conduit()
			});
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description:
					remoteErrorStatus(err) === 409
						? m.message_error_duplicate_conduit()
						: (remoteErrorMessage(err) ?? m.message_error_creating_conduit())
			});
		}
	}

	function clearParameters() {
		values = emptyConduitFormDefaults();
	}

	function handleOpenChange(open: boolean) {
		openPipeModal = open;
		if (open) values = loadConduitFormDefaults();
	}

	function handleClose() {
		openPipeModal = false;
		clearParameters();
	}
</script>

<Dialog
	open={openPipeModal}
	onOpenChange={(e) => handleOpenChange(e.open)}
	closeOnInteractOutside={true}
	closeOnEscape={true}
	onInteractOutside={clearParameters}
	onEscapeKeyDown={clearParameters}
>
	<Dialog.Trigger
		class="btn preset-filled-primary-500 {isHidden ? 'hidden' : ''}"
		data-testid="add-conduit-button"
	>
		<IconPlus size={18} />
		<span class="hidden sm:inline">{m.action_add_conduit()}</span>
	</Dialog.Trigger>

	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 backdrop-blur-sm" />

		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
			<Dialog.Content class="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm ">
				<Dialog.Title class="flex justify-between">
					<h2 class="h3">{m.action_add_conduit()}</h2>
				</Dialog.Title>

				<form id="pipe-form" class="space-y-4 grid grid-cols-2 gap-4" onsubmit={handleSubmit}>
					<label class="label">
						<span class="label-text">{m.common_name()}</span>
						<input
							id="pipe-name"
							type="text"
							class="input"
							placeholder=""
							name="pipe_name"
							required
							bind:value={values.conduitName}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.form_conduit_type()}</span>
						<GenericCombobox
							data={conduitTypes}
							bind:value={values.conduitType}
							renderInPlace={true}
							required={true}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.form_outer_conduit()}</span>
						<textarea
							name="outer_conduit"
							id="outer_conduit"
							class="textarea"
							placeholder=""
							bind:value={values.outerConduit}
						></textarea>
					</label>
					<label class="label">
						<span class="label-text">{m.form_status()}</span>
						<GenericCombobox data={statuses} bind:value={values.status} renderInPlace={true} />
					</label>
					<label class="label">
						<span class="label-text">{m.form_network_level()}</span>
						<GenericCombobox
							data={networkLevels}
							bind:value={values.networkLevel}
							renderInPlace={true}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.form_owner()}</span>
						<GenericCombobox data={companies} bind:value={values.owner} renderInPlace={true} />
					</label>
					<label class="label">
						<span class="label-text">{m.form_constructor()}</span>
						<GenericCombobox
							data={companies}
							bind:value={values.constructor}
							renderInPlace={true}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.form_manufacturer()}</span>
						<GenericCombobox
							data={companies}
							bind:value={values.manufacturer}
							renderInPlace={true}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.common_date()}</span>
						<input type="date" name="date" id="date" class="input" bind:value={values.date} />
					</label>
					<label class="label">
						<span class="label-text">{m.form_flag()}</span>
						<GenericCombobox
							data={flags}
							bind:value={values.flag}
							renderInPlace={true}
							required={true}
						/>
					</label>
				</form>

				<footer class="flex justify-end gap-4">
					<button type="button" class="btn preset-outlined" onclick={handleClose}>
						{m.action_close()}
					</button>
					<button type="submit" class="btn preset-filled" form="pipe-form">
						{m.action_save()}
					</button>
				</footer>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
