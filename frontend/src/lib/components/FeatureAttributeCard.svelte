<script>
	import { m } from '$lib/paraglide/messages';

	import { getFieldLabel } from '$lib/utils/featureUtils';

	/**
	 * @typedef {Object} Props
	 * @property {Record<string, any>} properties - Feature properties from MVT
	 * @property {string} featureType - Type of feature ('trench', 'address', 'node')
	 * @property {Record<string, string>} alias - Field name alias mapping (English -> Localized)
	 * @property {Array<{label: string, value: string}>} projects - List of projects for name lookup
	 */

	/** @type {Props} */
	let { properties = {}, featureType = 'trench', alias = {}, projects = [] } = $props();

	/**
	 * Get display name for a field key using alias or fallback
	 * @param {string} key - Property key
	 * @returns {string} - Display label
	 */
	function getDisplayLabel(key) {
		return alias[key] || getFieldLabel(key);
	}

	/**
	 * Format value for display
	 * @param {string} key - Property key
	 * @param {any} value
	 * @returns {string}
	 */
	function formatValue(key, value) {
		if (value === null || value === undefined) return '-';
		if (typeof value === 'boolean') return value ? m.common_yes() : m.common_no();
		if (value instanceof Date) return value.toLocaleDateString();

		if (key === 'project' && projects.length > 0) {
			const project = projects.find((p) => p.value === String(value));
			if (project) return project.label;
		}

		return String(value);
	}

	/**
	 * Get property entries for display (sorted alphabetically by display label)
	 * @returns {Array<[string, any]>}
	 */
	const propertyEntries = $derived(
		Object.entries(properties)
			.filter(([key, value]) => {
				return value !== null && value !== undefined;
			})
			.sort(([keyA], [keyB]) => {
				const labelA = getDisplayLabel(keyA);
				const labelB = getDisplayLabel(keyB);
				return labelA.localeCompare(labelB);
			})
	);
</script>

<!-- Attribute display card -->
<div>
	{#if propertyEntries.length === 0}
		<div class="text-surface-600-400 text-sm text-center py-8">
			{m.form_no_attributes_available()}
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			{#each propertyEntries as [key, value] (key)}
				<div class="flex flex-col gap-1">
					<label for="attr-{key}" class="label-text">{getDisplayLabel(key)}</label>
					<input
						id="attr-{key}"
						name="attr-{key}"
						type="text"
						class="input"
						readonly
						value={formatValue(key, value)}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>
