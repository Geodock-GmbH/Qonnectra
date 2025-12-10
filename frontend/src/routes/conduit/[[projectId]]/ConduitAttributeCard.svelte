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

	let messageBoxConfirm = $state(null);

	// Get conduit data from drawer store props
	let conduit = $derived($drawerStore.props);

	// Local state for form fields (using $derived for initial values, reassigned in $effect)
	let conduitName = $derived(conduit?.name || '');
	let conduitOuterConduit = $derived(conduit?.outer_conduit || '');
	let conduitType = $derived([conduit?.conduit_type?.id]);
	let conduitStatus = $derived([conduit?.status?.id]);
	let conduitNetworkLevel = $derived([conduit?.network_level?.id]);
	let conduitOwner = $derived([conduit?.owner?.id]);
	let conduitConstructor = $derived([conduit?.constructor?.id]);
	let conduitManufacturer = $derived([conduit?.manufacturer?.id]);
	let conduitDate = $derived(conduit?.date || '');
	let conduitFlag = $derived([conduit?.flag?.id]);

	let { onConduitUpdate, onConduitDelete } = $props();

	// Sync form fields when conduit changes
	$effect(() => {
		if (conduit) {
			conduitName = conduit.name || '';
			conduitOuterConduit = conduit.outer_conduit || '';
			conduitType = [conduit.conduit_type?.id];
			conduitStatus = [conduit.status?.id];
			conduitNetworkLevel = [conduit.network_level?.id];
			conduitOwner = [conduit.owner?.id];
			conduitConstructor = [conduit.constructor?.id];
			conduitManufacturer = [conduit.manufacturer?.id];
			conduitDate = conduit.date || '';
			conduitFlag = [conduit.flag?.id];
		}
	});

	async function handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData(event.target);
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
			if (onConduitUpdate && result.data?.conduit) {
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
		messageBoxConfirm.open();
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
				description: error.message || m.message_error_deleting_conduit()
			});
		}
	}
</script>

<!-- Conduit form -->
<form id="conduit-form" class="flex flex-col gap-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="text-sm">{m.common_name()}</span>
		<input
			type="text"
			class="input"
			placeholder=""
			name="conduit_name"
			required
			value={conduitName}
			oninput={(e) => (conduitName = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_conduit_type()}</span>
		<GenericCombobox
			data={attributes.conduitTypes}
			bind:value={conduitType}
			defaultValue={conduitType}
			onValueChange={(e) => (conduitType = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_outer_conduit()}</span>
		<textarea
			name="outer_conduit"
			class="textarea"
			placeholder=""
			value={conduitOuterConduit}
			oninput={(e) => (conduitOuterConduit = e.target.value)}
		></textarea>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={conduitStatus}
			defaultValue={conduitStatus}
			onValueChange={(e) => (conduitStatus = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={conduitNetworkLevel}
			defaultValue={conduitNetworkLevel}
			onValueChange={(e) => (conduitNetworkLevel = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitOwner}
			defaultValue={conduitOwner}
			onValueChange={(e) => (conduitOwner = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitConstructor}
			defaultValue={conduitConstructor}
			onValueChange={(e) => (conduitConstructor = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitManufacturer}
			defaultValue={conduitManufacturer}
			onValueChange={(e) => (conduitManufacturer = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.common_date()}</span>
		<input
			type="date"
			class="input"
			name="date"
			value={conduitDate}
			oninput={(e) => (conduitDate = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={conduitFlag}
			defaultValue={conduitFlag}
			onValueChange={(e) => (conduitFlag = e.value)}
		/>
	</label>
</form>

<!-- Delete and update buttons -->
<div class="mt-6 flex flex-col items-end justify-end gap-3">
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
