<script lang="ts">
	import { getContext } from 'svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';

	// Get attribute options from context (set in +page.svelte)
	const attributes = getContext<any>('attributeOptions') || {
		conduitTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: []
	};

	let messageBoxConfirm = $state<any>(null);

	// Get conduit data from drawer store props
	let conduit = $derived($drawerStore.props);

	// Mutable state for form fields - required for bind:value to work with GenericCombobox
	let conduitName = $state('');
	let conduitOuterConduit = $state('');
	let conduitType = $state<any[]>([]);
	let conduitStatus = $state<any[]>([]);
	let conduitNetworkLevel = $state<any[]>([]);
	let conduitOwner = $state<any[]>([]);
	let conduitConstructor = $state<any[]>([]);
	let conduitManufacturer = $state<any[]>([]);
	let conduitDate = $state('');
	let conduitFlag = $state<any[]>([]);

	let {
		onConduitUpdate,
		onConduitDelete
	}: {
		onConduitUpdate?: (conduit: any) => void;
		onConduitDelete?: (conduitId: string) => void;
	} = $props();

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
				(conduit.constructor as unknown as { id?: any })?.id != null
					? [(conduit.constructor as unknown as { id: any }).id]
					: [];
			conduitManufacturer = conduit.manufacturer?.id != null ? [conduit.manufacturer.id] : [];
			conduitDate = conduit.date || '';
			conduitFlag = conduit.flag?.id != null ? [conduit.flag.id] : [];
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const formData = new FormData(event.target as HTMLFormElement);
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
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating conduit',
				extraData: {
					from: 'ConduitAttributeCard.handleSubmit',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
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
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error deleting conduit',
				extraData: {
					from: 'ConduitAttributeCard.handleDelete',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
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
			oninput={(e) => (conduitName = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_conduit_type()}</span>
		<GenericCombobox
			data={attributes.conduitTypes}
			bind:value={conduitType}
			defaultValue={conduitType}
			onValueChange={(e: { value: any[] }) => (conduitType = e.value)}
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
			oninput={(e) => (conduitOuterConduit = (e.target as HTMLTextAreaElement).value)}
		></textarea>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={conduitStatus}
			defaultValue={conduitStatus}
			onValueChange={(e: { value: any[] }) => (conduitStatus = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={conduitNetworkLevel}
			defaultValue={conduitNetworkLevel}
			onValueChange={(e: { value: any[] }) => (conduitNetworkLevel = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitOwner}
			defaultValue={conduitOwner}
			onValueChange={(e: { value: any[] }) => (conduitOwner = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitConstructor}
			defaultValue={conduitConstructor}
			onValueChange={(e: { value: any[] }) => (conduitConstructor = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={conduitManufacturer}
			defaultValue={conduitManufacturer}
			onValueChange={(e: { value: any[] }) => (conduitManufacturer = e.value)}
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
			oninput={(e) => (conduitDate = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={conduitFlag}
			defaultValue={conduitFlag}
			onValueChange={(e: { value: any[] }) => (conduitFlag = e.value)}
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
