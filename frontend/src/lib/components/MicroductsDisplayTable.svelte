<script>
	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	/**
	 * @typedef {Object} Microduct
	 * @property {string} uuid
	 * @property {number} number
	 * @property {string} color
	 * @property {string} hex_code
	 * @property {{id: number, microduct_status: string}|null} [microduct_status]
	 * @property {{ properties?: { uuid_address?: { properties?: { street?: string, housenumber?: string, house_number_suffix?: string, zip_code?: string, city?: string } } } }} [uuid_node]
	 * @property {{ name?: string, type?: string }} [cable_connection]
	 */

	/**
	 * @typedef {Object} Props
	 * @property {Array<Microduct>} microducts - Array of microduct objects
	 * @property {boolean} loading - Loading state
	 * @property {string|null} error - Error message
	 * @property {import('svelte').Snippet<[Microduct]>} [actions] - Optional snippet for action buttons per microduct
	 * @property {boolean} [showStatus] - Whether to show the status column
	 * @property {boolean} [editableStatus] - Whether status is editable (dropdown)
	 * @property {Array<{id: number, microduct_status: string}>} [statusOptions] - Available status options
	 * @property {((microduct: Microduct, statusId: number|null) => void)|null} [onStatusChange] - Callback when status changes
	 */

	/** @type {Props} */
	let {
		microducts = [],
		loading = false,
		error = null,
		actions,
		showStatus = false,
		editableStatus = false,
		statusOptions = [],
		onStatusChange = null
	} = $props();

	const HEALTHY_VALUE = 'healthy';

	/** @type {Record<string, Array<string|number>>} */
	let statusValues = $state({});

	$effect(() => {
		/** @type {Record<string, Array<string|number>>} */
		const newValues = {};
		for (const md of microducts) {
			newValues[md.uuid] =
				md.microduct_status?.id != null ? [md.microduct_status.id] : [HEALTHY_VALUE];
		}
		statusValues = newValues;
	});

	const statusComboboxData = $derived([
		{ value: HEALTHY_VALUE, label: m.label_healthy() },
		...statusOptions.map((s) => ({ value: s.id, label: s.microduct_status }))
	]);

	/**
	 * Handle combobox value change
	 * @param {Microduct} microduct
	 * @param {{ value: Array<string|number> }} e
	 */
	function handleComboboxChange(microduct, e) {
		const selectedValue = e.value[0];
		/** @type {number|null} */
		const newValue = selectedValue === HEALTHY_VALUE ? null : /** @type {number} */ (selectedValue);
		if (onStatusChange) {
			onStatusChange(microduct, newValue);
		}
	}
</script>

{#if loading}
	<div class="p-4">
		<div class="placeholder animate-pulse min-h-6"></div>
	</div>
{:else if error}
	<div class="p-4 preset-filled-error-500 border rounded-lg">
		<p>{error}</p>
	</div>
{:else if microducts.length === 0}
	<div class="p-4 text-surface-600-400">
		<p>{m.form_no_microducts_available()}</p>
	</div>
{:else}
	<div class="table-container">
		<table class="table table-hover">
			<thead>
				<tr>
					<th>#</th>
					<th>{m.form_color()}</th>
					<th>{m.form_address({ count: 1 })}</th>
					<th>{m.form_cables()}</th>
					{#if showStatus}
						<th>{m.form_status()}</th>
					{/if}
					{#if actions}
						<th></th>
					{/if}
				</tr>
			</thead>
			<tbody class="[&>tr]:hover:preset-tonal-primary">
				{#each microducts as microduct (microduct.uuid)}
					<tr>
						<td class={microduct.microduct_status ? 'line-through opacity-60' : ''}
							>{microduct.number}</td
						>
						<td class={microduct.microduct_status ? 'line-through opacity-60' : ''}>
							<div class="flex items-center gap-2">
								<div
									class="w-4 h-4 rounded-full border border-surface-300"
									style="background-color: {microduct.hex_code}"
								></div>
								<span>{microduct.color}</span>
							</div>
						</td>
						<td>
							{#if microduct.uuid_node?.properties?.uuid_address?.properties}
								{@const props = microduct.uuid_node.properties.uuid_address.properties}
								{props.street}
								{props.housenumber}{props.house_number_suffix}{#if !props.house_number_suffix},{/if}{#if props.house_number_suffix},{/if}
								{props.zip_code}
								{props.city}
							{:else}
								<span></span>
							{/if}
						</td>
						<td>
							{#if microduct.cable_connection}
								{microduct.cable_connection.name}
								{#if microduct.cable_connection.type}
									({microduct.cable_connection.type})
								{/if}
							{/if}
						</td>
						{#if showStatus}
							<td class="min-w-32">
								{#if editableStatus && onStatusChange}
									<GenericCombobox
										data={statusComboboxData}
										bind:value={statusValues[microduct.uuid]}
										onValueChange={(/** @type {{ value: Array<string|number> }} */ e) => handleComboboxChange(microduct, e)}
										placeholder={m.form_status()}
										classes="w-full"
										placeholderSize="size-8"
										renderInPlace={true}
									/>
								{:else}
									<span class={microduct.microduct_status ? 'text-error-500' : 'text-success-500'}>
										{microduct.microduct_status?.microduct_status ?? m.label_healthy()}
									</span>
								{/if}
							</td>
						{/if}
						{#if actions}
							<td>
								{@render actions(microduct)}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
