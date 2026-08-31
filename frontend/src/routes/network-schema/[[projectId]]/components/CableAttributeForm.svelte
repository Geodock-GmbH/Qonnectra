<script lang="ts">
	import type { AttributeOptions, CableDrawerProps, FkRef } from '$lib/types/attributeCardTypes';
	import { untrack } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { updateCable } from '$lib/remote/network-schema/cables.remote';

	let {
		cable,
		attributes,
		connectedConduits,
		onLabelUpdate,
		onSaveComplete = () => {}
	}: {
		cable: CableDrawerProps;
		attributes: AttributeOptions;
		connectedConduits: string;
		onLabelUpdate?: (name: string) => void;
		onSaveComplete?: () => void | Promise<void>;
	} = $props();

	/**
	 * Build the editable field state from the cable prop's current value. Read
	 * via `untrack`: a one-time init, since the parent remounts this via
	 * `{#key cable.uuid}` when a different cable is opened (no prop-to-state effect).
	 */
	function initialFields(source: CableDrawerProps) {
		const toOption = (ref: FkRef | null | undefined) => (ref?.id != null ? [String(ref.id)] : []);
		return {
			name: source.name || '',
			cableType: toOption(source.cable_type),
			status: toOption(source.status),
			networkLevel: toOption(source.network_level),
			owner: toOption(source.owner),
			constructor: toOption(source.constructor as FkRef | null | undefined),
			manufacturer: toOption(source.manufacturer),
			date: source.date || '',
			reserveAtStart: source.reserve_at_start != null ? String(source.reserve_at_start) : '',
			reserveAtEnd: source.reserve_at_end != null ? String(source.reserve_at_end) : '',
			reserveSection: source.reserve_section != null ? String(source.reserve_section) : '',
			flag: toOption(source.flag)
		};
	}

	const initial = untrack(() => initialFields(cable));
	const cableLength = untrack(() => cable.length ?? '');
	const cableLengthTotal = untrack(() => cable.length_total ?? '');

	let cableName = $state(initial.name);
	let cableType = $state<string[]>(initial.cableType);
	let cableStatus = $state<string[]>(initial.status);
	let cableNetworkLevel = $state<string[]>(initial.networkLevel);
	let cableOwner = $state<string[]>(initial.owner);
	let cableConstructor = $state<string[]>(initial.constructor);
	let cableManufacturer = $state<string[]>(initial.manufacturer);
	let cableDate = $state(initial.date);
	let cableReserveAtStart = $state(initial.reserveAtStart);
	let cableReserveAtEnd = $state(initial.reserveAtEnd);
	let cableReserveSection = $state(initial.reserveSection);
	let cableFlag = $state<string[]>(initial.flag);

	/**
	 * Parse a single-select combobox value list into a number id, or undefined.
	 * @param value - The combobox value array.
	 */
	function toId(value: string[]): number | undefined {
		const raw = value?.[0];
		return raw ? parseInt(raw, 10) : undefined;
	}

	/**
	 * Parse a numeric input string, treating empty/invalid as undefined.
	 * @param value - The raw input value.
	 */
	function toNumber(value: string): number | undefined {
		if (value === '') return undefined;
		const parsed = parseInt(value, 10);
		return isNaN(parsed) ? undefined : parsed;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!cable.uuid) return;

		try {
			await updateCable({
				cableId: cable.uuid,
				name: cableName || undefined,
				cableTypeId: toId(cableType),
				statusId: toId(cableStatus),
				networkLevelId: toId(cableNetworkLevel),
				ownerId: toId(cableOwner),
				constructorId: toId(cableConstructor),
				manufacturerId: toId(cableManufacturer),
				flagId: toId(cableFlag),
				date: cableDate || undefined,
				reserveAtStart: toNumber(cableReserveAtStart),
				reserveAtEnd: toNumber(cableReserveAtEnd),
				reserveSection: toNumber(cableReserveSection)
			});

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
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating cable',
				extraData: {
					from: 'CableAttributeForm.handleSubmit',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_cable()
			});
		}
	}
</script>

<!-- Cable form -->
<form id="cable-form" class="flex flex-col gap-4 mr-4" onsubmit={handleSubmit}>
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
			oninput={(e) => (cableName = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_cable_type()}</span>
		<GenericCombobox
			data={attributes.cableTypes}
			bind:value={cableType}
			defaultValue={cableType}
			onValueChange={(e) => (cableType = e.value)}
			disabled={true}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_connected_conduits()}</span>
		<input
			id="connected-conduits"
			name="connected_conduits"
			type="text"
			class="input"
			readonly
			value={connectedConduits}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={cableStatus}
			defaultValue={cableStatus}
			onValueChange={(e) => (cableStatus = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={cableNetworkLevel}
			defaultValue={cableNetworkLevel}
			onValueChange={(e) => (cableNetworkLevel = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableOwner}
			defaultValue={cableOwner}
			onValueChange={(e) => (cableOwner = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableConstructor}
			defaultValue={cableConstructor}
			onValueChange={(e) => (cableConstructor = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={cableManufacturer}
			defaultValue={cableManufacturer}
			onValueChange={(e) => (cableManufacturer = e.value)}
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
			oninput={(e) => (cableDate = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={cableFlag}
			defaultValue={cableFlag}
			onValueChange={(e) => (cableFlag = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_reserve_at_start()}</span>
		<input
			id="reserve-at-start"
			type="number"
			class="input"
			name="reserve_at_start"
			value={cableReserveAtStart}
			oninput={(e) => (cableReserveAtStart = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_reserve_at_end()}</span>
		<input
			id="reserve-at-end"
			type="number"
			class="input"
			name="reserve_at_end"
			value={cableReserveAtEnd}
			oninput={(e) => (cableReserveAtEnd = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_reserve_section()}</span>
		<input
			id="reserve-section"
			type="number"
			class="input"
			name="reserve_section"
			value={cableReserveSection}
			oninput={(e) => (cableReserveSection = (e.target as HTMLInputElement).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.common_length()}</span>
		<input
			id="cable-length"
			type="number"
			class="input"
			name="length"
			readonly
			value={cableLength || 0}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_length_total()}</span>
		<input
			id="cable-length-total"
			type="number"
			class="input"
			name="length_total"
			readonly
			value={cableLengthTotal || 0}
		/>
	</label>
</form>
