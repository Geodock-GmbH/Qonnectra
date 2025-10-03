<script>
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { m } from '$lib/paraglide/messages';
	import { drawerStore } from '$lib/stores/drawer';

	let cable = $derived($drawerStore.props);
	let cableName = $derived(cable?.name || '');
	let cableType = $derived(cable?.cable_type?.cable_type || '');
	let cableStatus = $derived(cable?.status?.status || '');
	let cableNetworkLevel = $derived(cable?.network_level?.network_level || '');
	let cableOwner = $derived(cable?.owner?.company || '');
	let cableConstructor = $derived(cable?.constructor?.company || '');
	let cableManufacturer = $derived(cable?.manufacturer?.company || '');
	let cableDate = $derived(cable?.date || '');
	let cableLength = $derived(cable?.length || '');
	let cableLengthTotal = $derived(cable?.length_total || '');
	let cableReserveAtStart = $derived(cable?.reserve_at_start || '');
	let cableReserveAtEnd = $derived(cable?.reserve_at_end || '');
	let cableReserveSection = $derived(cable?.reserve_section || '');
	let cableFlag = $derived(cable?.flag?.flag || '');
</script>

<form id="cable-form" class="flex flex-col gap-4">
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
			bind:value={cableType}
			defaultValue={cableType}
			onValueChange={(e) => (cableType = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_status()}</span>
		<GenericCombobox
			bind:value={cableStatus}
			defaultValue={cableStatus}
			onValueChange={(e) => (cableStatus = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_network_level()}</span>
		<GenericCombobox
			bind:value={cableNetworkLevel}
			defaultValue={cableNetworkLevel}
			onValueChange={(e) => (cableNetworkLevel = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_owner()}</span>
		<GenericCombobox
			bind:value={cableOwner}
			defaultValue={cableOwner}
			onValueChange={(e) => (cableOwner = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_constructor()}</span>
		<GenericCombobox
			bind:value={cableConstructor}
			defaultValue={cableConstructor}
			onValueChange={(e) => (cableConstructor = e.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_manufacturer()}</span>
		<GenericCombobox
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
			oninput={(e) => (cableDate = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="label-text">{m.form_flag()}</span>
		<GenericCombobox
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

<footer class="mt-6 flex items-center justify-end gap-x-6">
	<button type="submit" form="cable-form" class="btn preset-filled">{m.common_confirm()}</button>
</footer>
