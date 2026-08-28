<script lang="ts">
	import type { Microduct } from '$lib/classes/ConduitDataManager.svelte';
	import type { Snippet } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	interface Props {
		/** Array of microduct objects */
		microducts?: Microduct[];
		/** Loading state */
		loading?: boolean;
		/** Error message */
		error?: string | null;
		/** Optional snippet for action buttons per microduct */
		actions?: Snippet<[Microduct]>;
		/** Whether to show the status column */
		showStatus?: boolean;
		/** Whether status is editable (dropdown) */
		editableStatus?: boolean;
		/** Available status options */
		statusOptions?: Array<{ id: number; microduct_status: string }>;
		/** Callback when status changes */
		onStatusChange?: ((microduct: Microduct, statusId: number | null) => void) | null;
	}

	let {
		microducts = [],
		loading = false,
		error = null,
		actions,
		showStatus = false,
		editableStatus = false,
		statusOptions = [],
		onStatusChange = null
	}: Props = $props();

	const HEALTHY_VALUE = 'healthy';

	let statusValues = $state<Record<string, Array<string | number>>>({});

	$effect(() => {
		const newValues: Record<string, Array<string | number>> = {};
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
	 */
	function handleComboboxChange(microduct: Microduct, e: { value: Array<string | number> }) {
		const selectedValue = e.value[0];
		const newValue: number | null =
			selectedValue === HEALTHY_VALUE ? null : (selectedValue as number);
		if (onStatusChange) {
			onStatusChange(microduct, newValue);
		}
	}
</script>

<!-- Loading / Error / Empty States -->
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
	<!-- Microducts Table -->
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
										onValueChange={(e: { value: Array<string | number> }) =>
											handleComboboxChange(microduct, e)}
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
