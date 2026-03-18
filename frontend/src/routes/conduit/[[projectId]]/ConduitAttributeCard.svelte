<script>
	import { getContext } from 'svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';

	// Get attribute options from context (set in +page.svelte)
	const attributes = getContext('attributeOptions') || {
		conduitTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: []
	};

	/** @type {any} */
	let messageBoxConfirm = $state(null);

	// Get conduit data from drawer store props
	let conduit = $derived($drawerStore.props);

	// Mutable state for form fields - required for bind:value to work with GenericCombobox
	let conduitName = $state('');
	let conduitOuterConduit = $state('');
	/** @type {any[]} */
	let conduitType = $state([]);
	/** @type {any[]} */
	let conduitStatus = $state([]);
	/** @type {any[]} */
	let conduitNetworkLevel = $state([]);
	/** @type {any[]} */
	let conduitOwner = $state([]);
	/** @type {any[]} */
	let conduitConstructor = $state([]);
	/** @type {any[]} */
	let conduitManufacturer = $state([]);
	let conduitDate = $state('');
	/** @type {any[]} */
	let conduitFlag = $state([]);

	let { onConduitUpdate, onConduitDelete } = $props();

	// Sync form fields when conduit changes
	$effect(() => {
		if (conduit) {
			conduitName = conduit.name || '';
			conduitOuterConduit = conduit.outer_conduit || '';
			conduitType = conduit.conduit_type?.id != null ? [conduit.conduit_type.id] : [];
			conduitStatus = conduit.status?.id != null ? [conduit.status.id] : [];
			conduitNetworkLevel = conduit.network_level?.id != null ? [conduit.network_level.id] : [];
			conduitOwner = conduit.owner?.id != null ? [conduit.owner.id] : [];
			conduitConstructor =
				/** @type {{ id?: any }} */ (/** @type {unknown} */ (conduit.constructor))?.id != null
					? [/** @type {{ id: any }} */ (/** @type {unknown} */ (conduit.constructor)).id]
					: [];
			conduitManufacturer = conduit.manufacturer?.id != null ? [conduit.manufacturer.id] : [];
			conduitDate = conduit.date || '';
			conduitFlag = conduit.flag?.id != null ? [conduit.flag.id] : [];
		}
	});

	async function handleSubmit(/** @type {SubmitEvent} */ event) {
		event.preventDefault();
		const formData = new FormData(/** @type {HTMLFormElement} */ (event.target));
		formData.append('uuid', conduit.uuid);
		formData.append('conduit_type_id', conduitType?.[0] || '');
		formData.append('status_id', conduitStatus?.[0] || '');
		formData.append('network_level_id', conduitNetworkLevel?.[0] || '');
		formData.append('owner_id', conduitOwner?.[0] || '');
		formData.append('constructor_id', conduitConstructor?.[0] || '');
		formData.append('manufacturer_id', conduitManufacturer?.[0] || '');
		formData.append('flag_id', conduitFlag?.[0] || '');

		try {
			const response = await fetch('?/updateConduit', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_conduit()
				});
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_conduit()
			});

			// Update drawer title and notify parent
			if (onConduitUpdate && result.type === 'success' && result.data?.conduit) {
				drawerStore.setTitle(conduitName);
				onConduitUpdate(result.data.conduit);
			}
		} catch (error) {
			console.error('Error updating conduit:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_conduit()
			});
		}
	}

	async function confirmDelete() {
		messageBoxConfirm?.open();
	}

	async function handleDelete() {
		if (!conduit.uuid) return;
		const formData = new FormData();
		formData.append('uuid', conduit.uuid);

		try {
			const response = await fetch('?/deleteConduit', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok && result.type !== 'error') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_deleting_conduit()
				});
				drawerStore.close();
				onConduitDelete?.(conduit.uuid);
			} else {
				throw new Error(result.message || m.message_error_deleting_conduit());
			}
		} catch (error) {
			console.error('Error deleting conduit:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error instanceof Error ? error.message : m.message_error_deleting_conduit()
			});
		}
	}
</script>

<!-- Conduit form -->
<form id="conduit-form" class="flex flex-col gap-4 mr-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="text-sm">{m.common_name()}</span>
		<input
			type="text"
			class="input"
			placeholder=""
			name="conduit_name"
			required
			value={conduitName}
			oninput={(e) => (conduitName = /** @type {HTMLInputElement} */ (e.target).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_conduit_type()}</span>
		<GenericCombobox
			data={attributes.conduitTypes}
			bind:value={conduitType}
			defaultValue={conduitType}
			onValueChange={(/** @type {{ value: any[] }} */ e) => (conduitType = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_outer_conduit()}</span>
		<textarea
			name="outer_conduit"
			class="textarea"
			placeholder=""
			value={conduitOuterConduit}
			oninput={(e) => (conduitOuterConduit = /** @type {HTMLTextAreaElement} */ (e.target).value)}
		></textarea>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={conduitStatus}
			defaultValue={conduitStatus}
			onValueChange={(/** @type {{ value: any[] }} */ e) => (conduitStatus = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={conduitNetworkLevel}
			defaultValue={conduitNetworkLevel}
			onValueChange={(/** @type {{ value: any[] }} */ e) => (conduitNetworkLevel = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitOwner}
			defaultValue={conduitOwner}
			onValueChange={(/** @type {{ value: any[] }} */ e) => (conduitOwner = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitConstructor}
			defaultValue={conduitConstructor}
			onValueChange={(/** @type {{ value: any[] }} */ e) => (conduitConstructor = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitManufacturer}
			defaultValue={conduitManufacturer}
			onValueChange={(/** @type {{ value: any[] }} */ e) => (conduitManufacturer = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.common_date()}</span>
		<input
			type="date"
			class="input"
			name="date"
			value={conduitDate}
			oninput={(e) => (conduitDate = /** @type {HTMLInputElement} */ (e.target).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={conduitFlag}
			defaultValue={conduitFlag}
			onValueChange={(/** @type {{ value: any[] }} */ e) => (conduitFlag = e.value)}
			renderInPlace={true}
		/>
	</label>
</form>

<!-- Delete and update buttons -->
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

<!-- Delete confirmation modal -->
<MessageBox
	bind:this={messageBoxConfirm}
	heading={m.common_confirm()}
	message={m.message_confirm_delete_conduit()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={handleDelete}
/>
