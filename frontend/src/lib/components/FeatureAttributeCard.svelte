<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { getFieldLabel } from '$lib/utils/featureUtils';

	interface Props {
		/** Feature properties from MVT */
		properties?: Record<string, unknown>;
		/** Type of feature ('trench', 'address', 'node') */
		featureType?: string;
		/** Field name alias mapping (English -> Localized) */
		alias?: Record<string, string>;
		/** List of projects for name lookup */
		projects?: Array<{ label: string; value: string }>;
	}

	let { properties = {}, featureType = 'trench', alias = {}, projects = [] }: Props = $props();

	/**
	 * Get display name for a field key using alias or fallback
	 * @param key - Property key
	 * @returns Display label
	 */
	function getDisplayLabel(key: string): string {
		return alias[key] || getFieldLabel(key);
	}

	/**
	 * Format value for display
	 * @param key - Property key
	 * @param value
	 */
	function formatValue(key: string, value: unknown): string {
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
