<script>
	import { m } from '$lib/paraglide/messages';
	import { getFieldLabel } from '$lib/utils/featureUtils';

	/**
	 * @typedef {Object} Props
	 * @property {Object} properties - Feature properties from MVT
	 * @property {string} featureType - Type of feature ('trench', 'address', 'node')
	 * @property {Object} alias - Field name alias mapping (English -> Localized)
	 */

	/** @type {Props} */
	let { properties = {}, featureType = 'trench', alias = {} } = $props();

	/**
	 * Get display name for a field key using alias or fallback
	 * @param {string} key - Property key
	 * @returns {string} - Display label
	 */
	function getDisplayLabel(key) {
		// Use alias if available, otherwise fall back to formatted label
		return alias[key] || getFieldLabel(key);
	}

	/**
	 * Format value for display
	 * @param {any} value
	 * @returns {string}
	 */
	function formatValue(value) {
		if (value === null || value === undefined) return '-';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (value instanceof Date) return value.toLocaleDateString();
		return String(value);
	}

	/**
	 * Get property entries for display
	 * @returns {Array<[string, any]>}
	 */
	const propertyEntries = $derived(
		Object.entries(properties).filter(([key, value]) => {
			// Skip null/undefined values
			return value !== null && value !== undefined;
		})
	);
</script>

<!-- Attribute display card -->
<div class="space-y-4">
	{#if propertyEntries.length === 0}
		<div class="text-surface-600-400 text-sm text-center py-8">
			{m.form_no_attributes_available()}
		</div>
	{:else}
		<div class="space-y-2">
			{#each propertyEntries as [key, value] (key)}
				<div
					class="flex flex-col gap-1 p-3 rounded-lg bg-surface-100-900 hover:bg-surface-200-800 transition-colors"
				>
					<div class="text-xs font-medium text-surface-600-400 uppercase tracking-wide">
						{getDisplayLabel(key)}
					</div>
					<div class="text-sm text-surface-900-50 break-words">
						{formatValue(value)}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
