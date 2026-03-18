<script>
	import { getContext } from 'svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';

	const attributes = getContext('attributeOptions') || {
		cableTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: []
	};

	/** @type {any} */
	let messageBoxConfirm = $state(null);
	let cable = $derived($drawerStore.props);
	let fiberCount = $derived(cable?.cable_type?.fiber_count || cable?.fiber_count || 0);
	let connectedSpliceCount = $state(0);
	let connectedConduits = $state('');

	$effect(() => {
		if (cable?.uuid) {
			connectedSpliceCount = 0;
			fetchConnectedConduits(cable.uuid);
		}
	});

	async function fetchConnectedConduits(/** @type {any} */ cableId) {
		try {
			const formData = new FormData();
			formData.append('cableId', cableId);
			const response = await fetch('?/getConduitsForCable', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				connectedConduits = /** @type {any} */ (result).data?.conduit_names?.join(', ') || '';
			}
		} catch (err) {
			console.error('Error fetching connected conduits:', err);
			connectedConduits = '';
		}
	}
	let cableName = $state('');
	/** @type {any[]} */
	let cableType = $state([]);
	/** @type {any[]} */
	let cableStatus = $state([]);
	/** @type {any[]} */
	let cableNetworkLevel = $state([]);
	/** @type {any[]} */
	let cableOwner = $state([]);
	/** @type {any[]} */
	let cableConstructor = $state([]);
	/** @type {any[]} */
	let cableManufacturer = $state([]);
	let cableDate = $state('');
	let cableLength = $derived(cable?.length || '');
	let cableLengthTotal = $derived(cable?.length_total || '');
	let cableReserveAtStart = $state('');
	let cableReserveAtEnd = $state('');
	let cableReserveSection = $state('');
	/** @type {any[]} */
	let cableFlag = $state([]);

	let { onLabelUpdate, onEdgeDelete, onSaveComplete = () => {} } = $props();

	$effect(() => {
		if (cable) {
			cableName = cable.name || '';
			cableType = cable.cable_type?.id != null ? [cable.cable_type.id] : [];
			cableStatus = cable.status?.id != null ? [cable.status.id] : [];
			cableNetworkLevel = cable.network_level?.id != null ? [cable.network_level.id] : [];
			cableOwner = cable.owner?.id != null ? [cable.owner.id] : [];
			cableConstructor =
				/** @type {any} */ (cable.constructor)?.id != null
					? [/** @type {any} */ (cable.constructor).id]
					: [];
			cableManufacturer = cable.manufacturer?.id != null ? [cable.manufacturer.id] : [];
			cableDate = cable.date || '';
			cableReserveAtStart = cable.reserve_at_start || '';
			cableReserveAtEnd = cable.reserve_at_end || '';
			cableReserveSection = cable.reserve_section || '';
			cableFlag = cable.flag?.id != null ? [cable.flag.id] : [];
		}
	});

	async function handleSubmit(/** @type {any} */ event) {
		event.preventDefault();
		const formData = new FormData(event.target);
		formData.append('uuid', cable.uuid);
		formData.append('cable_type_id', cableType?.[0] || '');
		formData.append('status_id', cableStatus?.[0] || '');
		formData.append('network_level_id', cableNetworkLevel?.[0] || '');
		formData.append('owner_id', cableOwner?.[0] || '');
		formData.append('constructor_id', cableConstructor?.[0] || '');
		formData.append('manufacturer_id', cableManufacturer?.[0] || '');
		formData.append('flag_id', cableFlag?.[0] || '');

		try {
			const response = await fetch('?/updateCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			if (result.type === 'error') {
				const errorMessage = result.error?.message;
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});
			if (onLabelUpdate && cableName) {
				onLabelUpdate(cableName);
			}
			await onSaveComplete();
		} catch (error) {
			console.error('Error updating cable:', error);
			globalToaster.error({
				title: m.message_error_updating_cable()
			});
		}
	}

	async function confirmDelete() {
		if (!cable?.uuid) return;

		try {
			const formData = new FormData();
			formData.append('cableUuid', cable.uuid);

			const response = await fetch('?/getCableSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			const splices = /** @type {any} */ (result).data?.splices || [];
			connectedSpliceCount = splices.length;
		} catch (err) {
			console.error('Error checking cable splices:', err);
			connectedSpliceCount = 0;
		}

		messageBoxConfirm.open();
	}

	async function handleDelete() {
		if (!cable.uuid) return;
		const formData = new FormData();
		formData.append('uuid', cable.uuid);

		try {
			const response = await fetch('?/deleteCable', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok && result.type !== 'error') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_deleting_cable()
				});
				drawerStore.close();
				onEdgeDelete?.(cable.uuid);
			} else {
				throw new Error(result.message || m.message_error_deleting_cable());
			}
		} catch (error) {
			console.error('Error deleting cable:', error);
			globalToaster.error({
				title: m.common_error(),
				description: /** @type {any} */ (error).message || m.message_error_deleting_cable()
			});
		}
	}
</script>

<!-- Cable form -->
<form id="cable-form" class="flex flex-col gap-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="text-sm">{m.common_name()}</span>
		<input
			id="cable-name"
			type="text"
			class="input"
			placeholder=""
			name="cable_name"
			required
			value={cableName}
			oninput={(e) => (cableName = /** @type {any} */ (e.target).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_cable_type()}</span>
		<GenericCombobox
			data={attributes.cableTypes}
			bind:value={cableType}
			defaultValue={cableType}
			onValueChange={(/** @type {any} */ e) => (cableType = e.value)}
			disabled={true}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_connected_conduits()}</span>
		<input id="connected-conduits" name="connected_conduits" type="text" class="input" readonly value={connectedConduits} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={cableStatus}
			defaultValue={cableStatus}
			onValueChange={(/** @type {any} */ e) => (cableStatus = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={cableNetworkLevel}
			defaultValue={cableNetworkLevel}
			onValueChange={(/** @type {any} */ e) => (cableNetworkLevel = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableOwner}
			defaultValue={cableOwner}
			onValueChange={(/** @type {any} */ e) => (cableOwner = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableConstructor}
			defaultValue={cableConstructor}
			onValueChange={(/** @type {any} */ e) => (cableConstructor = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableManufacturer}
			defaultValue={cableManufacturer}
			onValueChange={(/** @type {any} */ e) => (cableManufacturer = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.common_date()}</span>
		<input
			id="cable-date"
			type="date"
			class="input"
			name="date"
			value={cableDate}
			defaultValue={cableDate}
			oninput={(e) => (cableDate = /** @type {any} */ (e.target).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={cableFlag}
			defaultValue={cableFlag}
			onValueChange={(/** @type {any} */ e) => (cableFlag = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_reserve_at_start()}</span>
		<input id="reserve-at-start" type="number" class="input" name="reserve_at_start" value={cableReserveAtStart || 0} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_reserve_at_end()}</span>
		<input id="reserve-at-end" type="number" class="input" name="reserve_at_end" value={cableReserveAtEnd || 0} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_reserve_section()}</span>
		<input id="reserve-section" type="number" class="input" name="reserve_section" value={cableReserveSection || 0} />
	</label>
	<label class="label">
		<span class="text-sm">{m.common_length()}</span>
		<input id="cable-length" type="number" class="input" name="length" readonly value={cableLength || 0} />
	</label>
	<label class="label">
		<span class="text-sm">{m.form_length_total()}</span>
		<input id="cable-length-total" type="number" class="input" name="length_total" readonly value={cableLengthTotal || 0} />
	</label>
</form>

<!-- Delete and update buttons -->
<div class="mt-6 flex flex-col items-end justify-end gap-3">
	<button type="submit" form="cable-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
	<button type="button" onclick={confirmDelete} class="btn preset-filled-error-500 w-full">
		{m.action_delete_cable()}
	</button>
</div>

<!-- Delete confirmation modal -->
<MessageBox
	bind:this={messageBoxConfirm}
	heading={m.common_confirm()}
	message={connectedSpliceCount > 0
		? `${m.message_confirm_delete_cable()} ${connectedSpliceCount} ${m.form_fibers?.() || 'fibers'} ${m.common_connected_to_ports?.() || 'connected to ports'}.`
		: fiberCount > 0
			? `${m.message_confirm_delete_cable()} ${m.form_fibers?.() || 'Fibers'}: ${fiberCount}`
			: m.message_confirm_delete_cable()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={handleDelete}
/>
