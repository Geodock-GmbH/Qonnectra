<script>
	import { IconChevronDown, IconChevronRight } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	/**
	 * @typedef {Object} Fiber
	 * @property {string} uuid
	 * @property {number} bundle_number
	 * @property {string} bundle_color
	 * @property {number} fiber_number_in_bundle
	 * @property {string} fiber_color
	 * @property {{id: number, fiber_status: string}|null} [fiber_status]
	 */

	/**
	 * @typedef {Object} Props
	 * @property {Array<Fiber>} fibers - Array of fiber objects
	 * @property {boolean} loading - Loading state
	 * @property {string|null} error - Error message
	 * @property {Array<{id: number, fiber_status: string}>} statusOptions - Available status options
	 * @property {(fiber: Fiber, statusId: number|null) => void} onStatusChange - Callback when status changes
	 * @property {(colorName: string) => string} getColorHex - Function to get hex color from name
	 */

	/** @type {Props} */
	let {
		fibers = [],
		loading = false,
		error = null,
		statusOptions = [],
		onStatusChange,
		getColorHex
	} = $props();

	const HEALTHY_VALUE = 'healthy';

	/** @type {Record<string, Array<string|number>>} */
	let statusValues = $state({});

	/** @type {Set<number>} - Expanded bundle numbers */
	let expandedBundles = $state(new Set());

	$effect(() => {
		/** @type {Record<string, Array<string|number>>} */
		const newValues = {};
		for (const fiber of fibers) {
			newValues[fiber.uuid] =
				fiber.fiber_status?.id != null ? [fiber.fiber_status.id] : [HEALTHY_VALUE];
		}
		statusValues = newValues;
	});

	/**
	 * Group fibers by bundle number
	 */
	const bundleGroups = $derived.by(() => {
		const groups = new Map();
		for (const fiber of fibers) {
			const bundleKey = fiber.bundle_number;
			if (!groups.has(bundleKey)) {
				groups.set(bundleKey, {
					bundleNumber: fiber.bundle_number,
					bundleColor: fiber.bundle_color,
					fibers: []
				});
			}
			groups.get(bundleKey).fibers.push(fiber);
		}
		return Array.from(groups.values()).sort((a, b) => a.bundleNumber - b.bundleNumber);
	});

	const statusComboboxData = $derived([
		{ value: HEALTHY_VALUE, label: m.label_fiber_healthy() },
		...statusOptions.map((s) => ({ value: s.id, label: s.fiber_status }))
	]);

	/**
	 * Toggle bundle expansion
	 * @param {number} bundleNumber
	 */
	function toggleBundle(bundleNumber) {
		if (expandedBundles.has(bundleNumber)) {
			expandedBundles.delete(bundleNumber);
		} else {
			expandedBundles.add(bundleNumber);
		}
		expandedBundles = new Set(expandedBundles);
	}

	/**
	 * Handle combobox value change
	 * @param {Fiber} fiber
	 * @param {{ value: Array<string|number> }} e
	 */
	function handleComboboxChange(fiber, e) {
		const selectedValue = e.value[0];
		/** @type {number|null} */
		const newValue = selectedValue === HEALTHY_VALUE ? null : /** @type {number} */ (selectedValue);
		if (onStatusChange) {
			onStatusChange(fiber, newValue);
		}
	}

	/**
	 * Check if a fiber has a defective status
	 * @param {Fiber} fiber
	 * @returns {boolean}
	 */
	function isDefective(fiber) {
		return fiber.fiber_status != null;
	}

	/**
	 * Count defective fibers in a bundle
	 * @param {Array<Fiber>} bundleFibers
	 * @returns {number}
	 */
	function countDefective(bundleFibers) {
		return bundleFibers.filter((f) => f.fiber_status != null).length;
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
{:else if fibers.length === 0}
	<div class="p-4 text-surface-600-400">
		<p>{m.form_no_fibers_available()}</p>
	</div>
{:else}
	<div class="space-y-2">
		{#each bundleGroups as bundle (bundle.bundleNumber)}
			{@const defectiveCount = countDefective(bundle.fibers)}
			{@const isExpanded = expandedBundles.has(bundle.bundleNumber)}
			<div class="border border-surface-300-700 rounded-lg overflow-hidden">
				<button
					type="button"
					class="w-full flex items-center gap-3 p-3 hover:bg-surface-100-900 transition-colors"
					onclick={() => toggleBundle(bundle.bundleNumber)}
				>
					{#if isExpanded}
						<IconChevronDown size={18} />
					{:else}
						<IconChevronRight size={18} />
					{/if}
					<div
						class="w-5 h-5 rounded-full border border-surface-400"
						style="background-color: {getColorHex(bundle.bundleColor)}"
					></div>
					<span class="font-medium">
						{m.form_bundle()}
						{bundle.bundleNumber}
					</span>
					<span class="text-surface-500">
						({bundle.fibers.length}
						{m.form_fibers()})
					</span>
					{#if defectiveCount > 0}
						<span class="text-error-500 text-sm ml-auto">
							{defectiveCount}
							{m.label_defective()}
						</span>
					{/if}
				</button>

				{#if isExpanded}
					<div class="border-t border-surface-300-700">
						<table class="table table-hover w-full">
							<thead>
								<tr>
									<th class="w-16">#</th>
									<th>{m.form_color()}</th>
									<th class="w-48">{m.form_status()}</th>
								</tr>
							</thead>
							<tbody class="[&>tr]:hover:preset-tonal-primary">
								{#each bundle.fibers as fiber (fiber.uuid)}
									<tr>
										<td class={isDefective(fiber) ? 'line-through text-error-500 opacity-60' : ''}>
											{fiber.fiber_number_in_bundle}
										</td>
										<td class={isDefective(fiber) ? 'line-through text-error-500 opacity-60' : ''}>
											<div class="flex items-center gap-2">
												<div
													class="w-4 h-4 rounded-full border border-surface-300"
													style="background-color: {getColorHex(fiber.fiber_color)}"
												></div>
												<span>{fiber.fiber_color}</span>
											</div>
										</td>
										<td>
											<GenericCombobox
												data={statusComboboxData}
												bind:value={statusValues[fiber.uuid]}
												onValueChange={(/** @type {{ value: Array<string|number> }} */ e) =>
													handleComboboxChange(fiber, e)}
												placeholder={m.form_status()}
												classes="w-full"
												placeholderSize="size-8"
												renderInPlace={true}
											/>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
