<script>
	import { IconChevronDown, IconChevronRight, IconRoute } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	/** @typedef {import('$lib/classes/CableFiberDataManager.svelte.js').Fiber} Fiber */

	/**
	 * @typedef {Object} Props
	 * @property {Array<Fiber>} fibers - Array of fiber objects
	 * @property {boolean} loading - Loading state
	 * @property {string|null} error - Error message
	 * @property {(colorName: string) => string} getColorHex - Function to get hex color from name
	 * @property {(colorName: string) => string} [getColorName] - Function to get translated color name
	 * @property {(fiberUuid: string) => void} [onTraceFiber] - Optional callback for trace navigation
	 */

	/** @type {Props} */
	let { fibers = [], loading = false, error = null, getColorHex, getColorName, onTraceFiber } = $props();

	/** @type {Set<number>} - Expanded bundle numbers */
	let expandedBundles = $state(new Set());

	/**
	 * Group fibers by bundle number
	 */
	const bundleGroups = $derived.by(() => {
		if (!Array.isArray(fibers)) return [];
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
	 * Check if a fiber has a defective status.
	 * Fibers without an assigned status are considered healthy by default.
	 * Any assigned fiber_status indicates a non-healthy state.
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

	/**
	 * Get status display text
	 * @param {Fiber} fiber
	 * @returns {string}
	 */
	function getStatusDisplay(fiber) {
		if (fiber.fiber_status?.fiber_status) {
			return fiber.fiber_status.fiber_status;
		}
		return m.label_fiber_healthy();
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
{:else if fibers.length === 0}
	<div class="p-4 text-surface-600-400">
		<p>{m.form_no_fibers_available()}</p>
	</div>
{:else}
	<!-- Bundle Groups -->
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
									<th class="w-32">{m.form_status()}</th>
									{#if onTraceFiber}
										<th class="w-12"></th>
									{/if}
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
												<span
													>{getColorName
														? getColorName(fiber.fiber_color)
														: fiber.fiber_color}</span
												>
											</div>
										</td>
										<td>
											<span
												class="badge text-xs {isDefective(fiber)
													? 'preset-filled-error-500'
													: 'preset-filled-success-500'}"
											>
												{getStatusDisplay(fiber)}
											</span>
										</td>
										{#if onTraceFiber}
											<td>
												<button
													type="button"
													class="p-1 rounded hover:bg-surface-300-700 transition-colors"
													onclick={() => onTraceFiber(fiber.uuid)}
													aria-label={m.action_trace()}
												>
													<IconRoute size={16} />
												</button>
											</td>
										{/if}
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
