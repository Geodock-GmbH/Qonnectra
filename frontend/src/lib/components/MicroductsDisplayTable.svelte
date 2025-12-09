<script>
	import { m } from '$lib/paraglide/messages';

	/**
	 * @typedef {Object} Props
	 * @property {Array<Object>} microducts - Array of microduct objects
	 * @property {boolean} loading - Loading state
	 * @property {string|null} error - Error message
	 * @property {import('svelte').Snippet<[Object]>} [actions] - Optional snippet for action buttons per microduct
	 */

	/** @type {Props} */
	let { microducts = [], loading = false, error = null, actions } = $props();
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
					<th>{m.form_number()}</th>
					<th>{m.form_color()}</th>
					<th>{m.form_address({ count: 1 })}</th>
					{#if actions}
						<th></th>
					{/if}
				</tr>
			</thead>
			<tbody class="[&>tr]:hover:preset-tonal-primary">
				{#each microducts as microduct (microduct.uuid)}
					<tr>
						<td>{microduct.number}</td>
						<td>
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
