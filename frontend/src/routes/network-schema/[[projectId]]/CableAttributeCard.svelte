<script>
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { m } from '$lib/paraglide/messages';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { getContext } from 'svelte';

	const attributes = getContext('cableAttributes') || {
		cableTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: []
	};

	let cable = $derived($drawerStore.props);
	let cableName = $derived(cable?.name || '');
	let cableType = $derived([cable?.cable_type?.id]);
	let cableStatus = $derived([cable?.status?.id]);
	let cableNetworkLevel = $derived([cable?.network_level?.id]);
	let cableOwner = $derived([cable?.owner?.id]);
	let cableConstructor = $derived([cable?.constructor?.id]);
	let cableManufacturer = $derived([cable?.manufacturer?.id]);
	let cableDate = $derived(cable?.date || '');
	let cableLength = $derived(cable?.length || '');
	let cableLengthTotal = $derived(cable?.length_total || '');
	let cableReserveAtStart = $derived(cable?.reserve_at_start || '');
	let cableReserveAtEnd = $derived(cable?.reserve_at_end || '');
	let cableReserveSection = $derived(cable?.reserve_section || '');
	let cableFlag = $derived([cable?.flag?.id]);

	// Update state when cable changes
	$effect(() => {
		if (cable) {
			cableName = cable.name || '';
			cableType = [cable.cable_type?.id];
			cableStatus = [cable.status?.id];
			cableNetworkLevel = [cable.network_level?.id];
			cableOwner = [cable.owner?.id];
			cableConstructor = [cable.constructor?.id];
			cableManufacturer = [cable.manufacturer?.id];
			cableDate = cable.date || '';
			cableReserveAtStart = cable.reserve_at_start || '';
			cableReserveAtEnd = cable.reserve_at_end || '';
			cableReserveSection = cable.reserve_section || '';
			cableFlag = [cable.flag?.id];
		}
	});

	async function handleSubmit(event) {
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

			const result = await response.json();

			if (response.ok && result.type !== 'error') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_updating_cable()
				});
			} else {
				throw new Error(result.message || 'Failed to update cable');
			}
		} catch (error) {
			console.error('Error updating cable:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message || 'Failed to update cable'
			});
		}
	}

	async function handleDelete() {
		if (!confirm(m.message_confirm_delete_cable())) {
			return;
		}

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
				window.location.reload();
			} else {
				throw new Error(result.message || m.message_error_deleting_cable());
			}
		} catch (error) {
			console.error('Error deleting cable:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message || m.message_error_deleting_cable()
			});
		}
	}
</script>

<form id="cable-form" class="flex flex-col gap-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="label-text">{m.common_name()}</span>
		<input
			type="text"
			class="input"
			placeholder=""
			name="cable_name"
			required
			value={cableName}
			oninput={(e) => (cableName = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_cable_type()}</span>
		<GenericCombobox
			data={attributes.cableTypes}
			bind:value={cableType}
			defaultValue={cableType}
			onValueChange={(e) => (cableType = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={cableStatus}
			defaultValue={cableStatus}
			onValueChange={(e) => (cableStatus = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={cableNetworkLevel}
			defaultValue={cableNetworkLevel}
			onValueChange={(e) => (cableNetworkLevel = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableOwner}
			defaultValue={cableOwner}
			onValueChange={(e) => (cableOwner = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableConstructor}
			defaultValue={cableConstructor}
			onValueChange={(e) => (cableConstructor = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableManufacturer}
			defaultValue={cableManufacturer}
			onValueChange={(e) => (cableManufacturer = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.common_date()}</span>
		<input
			type="date"
			class="input"
			name="date"
			value={cableDate}
			defaultValue={cableDate}
			oninput={(e) => (cableDate = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={cableFlag}
			defaultValue={cableFlag}
			onValueChange={(e) => (cableFlag = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_reserve_at_start()}</span>
		<input type="number" class="input" name="reserve_at_start" value={cableReserveAtStart || 0} />
	</label>
	<label class="label">
		<span class="label-text">{m.form_reserve_at_end()}</span>
		<input type="number" class="input" name="reserve_at_end" value={cableReserveAtEnd || 0} />
	</label>
	<label class="label">
		<span class="label-text">{m.form_reserve_section()}</span>
		<input type="number" class="input" name="reserve_section" value={cableReserveSection || 0} />
	</label>
	<label class="label">
		<span class="label-text">{m.common_length()}</span>
		<input type="number" class="input" name="length" readonly value={cableLength || 0} />
	</label>
	<label class="label">
		<span class="label-text">{m.form_length_total()}</span>
		<input type="number" class="input" name="length_total" readonly value={cableLengthTotal || 0} />
	</label>
</form>

<div class="mt-6 flex flex-col sm:flex-row items-end justify-end gap-3">
	<button type="button" onclick={handleDelete} class="btn preset-filled-error-500 w-full sm:w-auto">
		{m.action_delete_cable()}
	</button>
	<button type="submit" form="cable-form" class="btn preset-filled w-full sm:w-auto">
		{m.action_refresh()}
	</button>
</div>
