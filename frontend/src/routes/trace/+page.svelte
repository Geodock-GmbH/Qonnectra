<script>
	import { get } from 'svelte/store';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import {
		IconBuildings,
		IconChevronDown,
		IconLoader2,
		IconMapPin,
		IconPlug,
		IconRouter,
		IconSearch,
		IconSTurnRight,
		IconX
	} from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { selectedProject } from '$lib/stores/store';

	const traceTypes = [
		{
			value: 'address',
			label: () => m.form_address({ count: 1 }),
			icon: IconMapPin,
			color: 'text-error-500',
			searchable: true,
			searchPlaceholder: () => m.trace_search_address_placeholder()
		},
		{
			value: 'node',
			label: () => m.form_node(),
			icon: IconRouter,
			color: 'text-success-500',
			searchable: true,
			searchPlaceholder: () => m.trace_search_node_placeholder()
		},
		{
			value: 'cable',
			label: () => m.form_cables(),
			icon: IconPlug,
			color: 'text-warning-500',
			searchable: true,
			searchPlaceholder: () => m.trace_search_cable_placeholder()
		},
		{
			value: 'residential_unit',
			label: () => m.form_residential_units(),
			icon: IconBuildings,
			color: 'text-secondary-500',
			searchable: true,
			searchPlaceholder: () => m.trace_search_ru_placeholder()
		},
		{
			value: 'fiber',
			label: () => m.form_fiber(),
			icon: IconSTurnRight,
			color: 'text-primary-500',
			searchable: true,
			searchPlaceholder: () => m.trace_search_cable_placeholder()
		}
	];

	let activeTab = $state('address');
	let searchQuery = $state('');
	/** @type {Record<string, any>[]} */
	let searchResults = $state([]);
	let searching = $state(false);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let searchTimeout = null;

	let globalSearch = $state(false);
	let includeGeometry = $state(false);
	let geometryMode = $state('segments');
	let orientGeometry = $state(false);

	/** @type {Record<string, any> | null} */
	let selectedCable = $state(null);
	/** @type {Record<string, any>[]} */
	let fibers = $state([]);
	let loadingFibers = $state(false);
	let expandedBundles = $state(new Set());
	let fiberColors = $state(new Map());

	const fibersByBundle = $derived.by(() => {
		const grouped = new Map();
		for (const fiber of fibers) {
			const bundleNum = fiber.bundle_number ?? 0;
			if (!grouped.has(bundleNum)) {
				grouped.set(bundleNum, {
					bundleNumber: bundleNum,
					bundleColor: fiber.bundle_color,
					fibers: []
				});
			}
			grouped.get(bundleNum).fibers.push(fiber);
		}
		return Array.from(grouped.values()).sort((a, b) => a.bundleNumber - b.bundleNumber);
	});

	const activeType = $derived(traceTypes.find((t) => t.value === activeTab));

	/**
	 * Switches the active trace type tab and resets search/fiber state.
	 * @param {string} tab - The trace type value to switch to.
	 */
	function handleTabChange(tab) {
		activeTab = tab;
		searchQuery = '';
		searchResults = [];
		selectedCable = null;
		fibers = [];
		expandedBundles = new Set();
	}

	/**
	 * Searches for entities of the active trace type via the API.
	 * @param {string} query - Search string (minimum 2 characters).
	 */
	async function performSearch(query) {
		if (!query || query.length < 2) {
			searchResults = [];
			return;
		}

		searching = true;
		try {
			const searchType = activeTab === 'fiber' ? 'cable' : activeTab;
			const params = new URLSearchParams({
				search: query,
				type: searchType
			});
			if (!globalSearch) {
				params.set('project', get(selectedProject));
			}

			const response = await fetch(`${PUBLIC_API_URL}trace-search/?${params}`, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Search failed');

			const data = await response.json();
			searchResults = data.results || [];
		} catch (err) {
			console.error('Search error:', err);
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	/**
	 * Debounces search input and triggers a search after 300ms.
	 * @param {Event & { currentTarget: HTMLInputElement }} e - Input event from the search field.
	 */
	function handleSearchInput(e) {
		const query = e.currentTarget.value;
		searchQuery = query;

		if (searchTimeout) clearTimeout(searchTimeout);

		searchTimeout = setTimeout(() => {
			performSearch(query);
		}, 300);
	}

	/**
	 * Builds a trace URL with optional geometry query parameters.
	 * @param {string} typeSlug - The entity type slug for the URL path.
	 * @param {string} uuid - The entity UUID.
	 * @returns {string} The complete trace URL.
	 */
	function buildTraceUrl(typeSlug, uuid) {
		let url = `/trace/${typeSlug}/${uuid}`;
		const params = new URLSearchParams();

		if (includeGeometry) {
			params.set('include_geometry', 'true');
			params.set('geometry_mode', geometryMode);
			if (orientGeometry) {
				params.set('orient_geometry', 'true');
			}
		}

		const queryString = params.toString();
		return queryString ? `${url}?${queryString}` : url;
	}

	/**
	 * Navigates to the trace page for a selected search result.
	 * @param {Record<string, any>} result - The selected search result containing a uuid.
	 */
	function selectResult(result) {
		const uuid = result.uuid;
		const typeSlug = activeTab === 'residential_unit' ? 'residential-unit' : activeTab;
		goto(buildTraceUrl(typeSlug, uuid));
	}

	/**
	 * Selects a cable and fetches its fibers for the fiber trace picker.
	 * @param {Record<string, any>} cable - The selected cable object.
	 */
	async function selectCableForFiber(cable) {
		selectedCable = cable;
		searchQuery = '';
		searchResults = [];
		expandedBundles = new Set();

		loadingFibers = true;
		try {
			const [fibersResponse] = await Promise.all([
				fetch(`${PUBLIC_API_URL}fiber/by-cable/${cable.uuid}/`, { credentials: 'include' }),
				fetchFiberColors()
			]);
			if (!fibersResponse.ok) throw new Error('Failed to fetch fibers');
			fibers = await fibersResponse.json();

			if (fibersByBundle.length === 1) {
				expandedBundles = new Set([fibersByBundle[0].bundleNumber]);
			}
		} catch (err) {
			console.error('Failed to fetch fibers:', err);
			fibers = [];
		} finally {
			loadingFibers = false;
		}
	}

	/**
	 * Clears the selected cable and resets fiber state.
	 */
	function clearCableSelection() {
		selectedCable = null;
		fibers = [];
		expandedBundles = new Set();
	}

	/**
	 * Toggles expansion of a fiber bundle in the picker.
	 * @param {number} bundleNumber - The bundle number to toggle.
	 */
	function toggleBundle(bundleNumber) {
		const newSet = new Set(expandedBundles);
		if (newSet.has(bundleNumber)) {
			newSet.delete(bundleNumber);
		} else {
			newSet.add(bundleNumber);
		}
		expandedBundles = newSet;
	}

	/**
	 * Navigates to the trace page for a specific fiber.
	 * @param {Record<string, any>} fiber - Fiber object containing uuid.
	 */
	function traceFiber(fiber) {
		goto(buildTraceUrl('fiber', fiber.uuid));
	}

	/**
	 * Formats an address search result for display.
	 * @param {Record<string, any>} result - Address result from the API.
	 * @returns {string} Formatted address string.
	 */
	function formatAddressResult(result) {
		const parts = [];
		if (result.street) parts.push(result.street);
		if (result.housenumber) parts.push(result.housenumber + (result.house_number_suffix || ''));
		if (result.zip_code || result.city) {
			parts.push(`${result.zip_code || ''} ${result.city || ''}`.trim());
		}
		return parts.join(', ') || result.uuid?.slice(0, 8);
	}

	/**
	 * Formats a node search result for display.
	 * @param {Record<string, any>} result - Node result from the API.
	 * @returns {string} Formatted node name or truncated UUID.
	 */
	function formatNodeResult(result) {
		return result.name || result.uuid?.slice(0, 8);
	}

	/**
	 * Formats a cable search result for display.
	 * @param {Record<string, any>} result - Cable result from the API.
	 * @returns {string} Formatted cable name or truncated UUID.
	 */
	function formatCableResult(result) {
		return result.name || result.uuid?.slice(0, 8);
	}

	/**
	 * Formats a residential unit search result for display.
	 * @param {Record<string, any>} result - Residential unit result from the API.
	 * @returns {string} Formatted residential unit string.
	 */
	function formatRuResult(result) {
		const parts = [];
		if (result.id_residential_unit) parts.push(result.id_residential_unit);
		if (result.floor !== null && result.floor !== undefined)
			parts.push(`${m.form_floor()} ${result.floor}`);
		if (result.side) parts.push(result.side);
		return parts.join(' - ') || result.uuid?.slice(0, 8);
	}

	/**
	 * Formats a search result based on the active trace type.
	 * @param {Record<string, any>} result - Search result from the API.
	 * @returns {string} Formatted display string.
	 */
	function formatResult(result) {
		switch (activeTab) {
			case 'address':
				return formatAddressResult(result);
			case 'node':
				return formatNodeResult(result);
			case 'cable':
			case 'fiber':
				return formatCableResult(result);
			case 'residential_unit':
				return formatRuResult(result);
			default:
				return result.uuid?.slice(0, 8);
		}
	}

	/**
	 * Returns a subtitle string for a search result based on the active trace type.
	 * @param {Record<string, any>} result - Search result from the API.
	 * @returns {string | null} Subtitle string, or null if none available.
	 */
	function getResultSubtitle(result) {
		switch (activeTab) {
			case 'address':
				return result.id_address || null;
			case 'node':
				return result.node_type || null;
			case 'cable':
			case 'fiber':
				return result.cable_type?.cable_type || result.cable_type || null;
			case 'residential_unit':
				return result.address_street
					? `${result.address_street} ${result.address_housenumber || ''}`
					: null;
			default:
				return null;
		}
	}

	/**
	 * Fetches fiber color attribute mappings from the API and caches them.
	 */
	async function fetchFiberColors() {
		if (fiberColors.size > 0) return;
		try {
			const response = await fetch(`${PUBLIC_API_URL}attributes_fiber_color/`, {
				credentials: 'include'
			});
			if (!response.ok) return;
			const data = await response.json();
			const colors = data.results || data || [];
			const colorMap = new Map();
			for (const color of colors) {
				if (color.name_de) colorMap.set(color.name_de.toLowerCase(), color.hex_code);
				if (color.name_en) colorMap.set(color.name_en.toLowerCase(), color.hex_code);
			}
			fiberColors = colorMap;
		} catch (err) {
			console.error('Failed to fetch fiber colors:', err);
		}
	}

	/**
	 * Resolves a color name to its hex code.
	 * @param {string | null} colorName - The color name to look up.
	 * @returns {string} Hex color code, or a default gray.
	 */
	function getColorHex(colorName) {
		if (!colorName) return '#6b7280';
		return fiberColors.get(colorName.toLowerCase()) || '#6b7280';
	}
</script>

<!-- Tab Selector -->
<div class="mb-6 rounded-xl border border-surface-200-800 p-1.5 sm:p-2">
	<div class="flex gap-1 sm:gap-2">
		{#each traceTypes as type (type.value)}
			{@const Icon = type.icon}
			<button
				type="button"
				onclick={() => handleTabChange(type.value)}
				class="flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 transition-colors sm:px-4 sm:py-3 {activeTab ===
				type.value
					? 'bg-primary-500 text-white'
					: 'hover:bg-surface-100-900'}"
				title={type.label()}
			>
				<Icon size={20} class={activeTab === type.value ? 'text-white' : type.color} />
				<span class="hidden text-sm font-medium sm:inline">{type.label()}</span>
			</button>
		{/each}
	</div>
</div>

<!-- Options -->
<div class="mb-6 rounded-xl border border-surface-200-800 p-3 sm:p-4">
	<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={globalSearch}
				onchange={() => {
					if (searchQuery.length >= 2) performSearch(searchQuery);
					else searchResults = [];
				}}
				class="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
			/>
			<span class="text-sm font-medium text-surface-900-100">{m.trace_search_global()}</span>
		</label>

		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={includeGeometry}
				class="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
			/>
			<span class="text-sm font-medium text-surface-900-100">{m.trace_include_geometry()}</span>
		</label>

		{#if includeGeometry}
			<div class="flex items-center gap-2" transition:slide={{ duration: 150 }}>
				<span class="text-sm text-surface-600-400">{m.trace_geometry_mode()}:</span>
				<GenericCombobox
					data={[
						{ value: 'segments', label: m.trace_geometry_segments() },
						{ value: 'merged', label: m.trace_geometry_merged() },
						{ value: 'routed', label: m.trace_geometry_routed() }
					]}
					value={[geometryMode]}
					onValueChange={(/** @type {{ value: string[] }} */ e) => {
						geometryMode = e.value[0] || 'segments';
					}}
					classes="touch-manipulation w-40 sm:w-48"
				/>
			</div>

			<label class="flex cursor-pointer items-center gap-2" transition:slide={{ duration: 150 }}>
				<input
					type="checkbox"
					bind:checked={orientGeometry}
					class="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
				/>
				<span class="text-sm text-surface-900-100">{m.trace_orient_geometry()}</span>
			</label>
		{/if}
	</div>
</div>

<!-- Search Section -->
<div class="rounded-xl border border-surface-200-800 p-3 sm:p-6">
	{#if activeType}
		<!-- Fiber Tab: Show cable selection then fiber picker -->
		{#if activeTab === 'fiber'}
			{#if selectedCable}
				<!-- Selected Cable Header -->
				<div class="mb-4 flex items-center gap-3 rounded-lg bg-surface-100-900 px-4 py-3">
					<IconPlug size={20} class="text-warning-500" />
					<div class="min-w-0 flex-1">
						<div class="font-medium text-surface-900-100">{selectedCable.name}</div>
						{#if selectedCable.cable_type?.cable_type}
							<div class="text-xs text-surface-600-400">{selectedCable.cable_type.cable_type}</div>
						{/if}
					</div>
					<span class="text-sm text-surface-600-400">{fibers.length} {m.form_fibers()}</span>
					<button
						type="button"
						onclick={clearCableSelection}
						class="rounded-full p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-700-300"
						title={m.action_change()}
					>
						<IconX size={18} />
					</button>
				</div>

				<!-- Fiber Selection by Bundle -->
				{#if loadingFibers}
					<div class="flex items-center justify-center py-8">
						<IconLoader2
							size={24}
							class="text-primary-500"
							style="animation: spin 1s linear infinite"
						/>
					</div>
				{:else if fibersByBundle.length > 0}
					<div class="space-y-2">
						{#each fibersByBundle as bundle (bundle.bundleNumber)}
							<div class="rounded-lg border border-surface-200-800">
								<!-- Bundle Header -->
								<button
									type="button"
									onclick={() => toggleBundle(bundle.bundleNumber)}
									class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-50-950"
								>
									<IconChevronDown
										size={18}
										class="text-surface-500-400 transition-transform {expandedBundles.has(
											bundle.bundleNumber
										)
											? ''
											: '-rotate-90'}"
									/>
									<span
										class="h-4 w-4 rounded-full border border-surface-300"
										style="background-color: {getColorHex(bundle.bundleColor)}"
									></span>
									<span class="font-medium text-surface-900-100">
										{m.form_bundle()}
										{bundle.bundleNumber}
									</span>
									<span class="text-sm text-surface-600-400">
										({bundle.fibers.length}
										{m.form_fibers()})
									</span>
								</button>

								<!-- Fiber List -->
								{#if expandedBundles.has(bundle.bundleNumber)}
									<div class="border-t border-surface-200-800" transition:slide={{ duration: 150 }}>
										<table class="w-full text-sm">
											<thead>
												<tr
													class="border-b border-surface-100-900 text-left text-xs text-surface-600-400"
												>
													<th class="px-4 py-2 font-medium">#</th>
													<th class="px-4 py-2 font-medium">{m.form_color()}</th>
													<th class="px-4 py-2 font-medium"></th>
												</tr>
											</thead>
											<tbody>
												{#each bundle.fibers as fiber (fiber.uuid)}
													<tr
														class="cursor-pointer border-b border-surface-100-900 last:border-b-0 hover:bg-surface-50-950"
														onclick={() => traceFiber(fiber)}
													>
														<td class="px-4 py-2 font-mono text-surface-900-100">
															{fiber.fiber_number_in_bundle}
														</td>
														<td class="px-4 py-2">
															<div class="flex items-center gap-2">
																<span
																	class="h-3.5 w-3.5 rounded-full border border-surface-300"
																	style="background-color: {getColorHex(fiber.fiber_color)}"
																></span>
																<span class="text-surface-700-300">{fiber.fiber_color || '-'}</span>
															</div>
														</td>
														<td class="px-4 py-2 text-right">
															<button
																type="button"
																class="rounded bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-500 hover:bg-primary-500/20"
															>
																{m.action_trace()}
															</button>
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
				{:else}
					<div class="py-8 text-center text-sm text-surface-500-400">
						{m.trace_no_fibers_in_cable()}
					</div>
				{/if}
			{:else}
				<!-- Cable Search for Fiber Selection -->
				<div class="mb-2 text-sm text-surface-600-400">{m.trace_select_cable_first()}</div>
				<div class="relative">
					<IconSearch
						size={20}
						class="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500-400"
					/>
					<input
						type="text"
						value={searchQuery}
						oninput={handleSearchInput}
						placeholder={activeType.searchPlaceholder()}
						autocomplete="off"
						spellcheck="false"
						class="w-full rounded-lg border border-surface-200-800 bg-transparent py-3 pl-12 pr-4 text-surface-900-100 placeholder:text-surface-500-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
					/>
					{#if searching}
						<IconLoader2
							size={20}
							class="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500"
							style="animation: spin 1s linear infinite"
						/>
					{/if}
				</div>

				<!-- Cable Search Results -->
				{#if searchResults.length > 0}
					<div
						class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-surface-200-800"
						transition:slide={{ duration: 200 }}
					>
						{#each searchResults as result (result.uuid)}
							<button
								type="button"
								onclick={() => selectCableForFiber(result)}
								class="flex w-full items-center gap-3 border-b border-surface-100-900 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-100-900"
							>
								<IconPlug size={18} class="text-warning-500" />
								<div class="min-w-0 flex-1">
									<div class="truncate font-medium text-surface-900-100">
										{formatResult(result)}
									</div>
									{#if getResultSubtitle(result)}
										<div class="truncate text-xs text-surface-600-400">
											{getResultSubtitle(result)}
										</div>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- No results / hint -->
				{#if searchQuery.length >= 2 && !searching && searchResults.length === 0}
					<div
						class="mt-4 py-4 text-center text-surface-600-400"
						transition:slide={{ duration: 200 }}
					>
						{m.common_no_results()}
					</div>
				{:else if searchQuery.length < 2 && !searching}
					<div class="mt-4 py-4 text-center text-sm text-surface-600-400">
						{m.trace_search_hint()}
					</div>
				{/if}
			{/if}
		{:else}
			<!-- Other Tabs: Standard Search -->
			<div class="relative">
				<div class="relative">
					<IconSearch
						size={20}
						class="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500-400"
					/>
					<input
						type="text"
						value={searchQuery}
						oninput={handleSearchInput}
						placeholder={activeType.searchPlaceholder()}
						autocomplete="off"
						spellcheck="false"
						class="w-full rounded-lg border border-surface-200-800 bg-transparent py-3 pl-12 pr-4 text-surface-900-100 placeholder:text-surface-500-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
					/>
					{#if searching}
						<IconLoader2
							size={20}
							class="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500"
							style="animation: spin 1s linear infinite"
						/>
					{/if}
				</div>

				<!-- Search Results -->
				{#if activeType.searchable && searchResults.length > 0}
					<div
						class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-surface-200-800"
						transition:slide={{ duration: 200 }}
					>
						{#each searchResults as result (result.uuid)}
							{@const Icon = activeType.icon}
							<button
								type="button"
								onclick={() => selectResult(result)}
								class="flex w-full items-center gap-3 border-b border-surface-100-900 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-100-900"
							>
								<Icon size={18} class={activeType.color} />
								<div class="min-w-0 flex-1">
									<div class="truncate font-medium text-surface-900-100">
										{formatResult(result)}
									</div>
									{#if getResultSubtitle(result)}
										<div class="truncate text-xs text-surface-600-400">
											{getResultSubtitle(result)}
										</div>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- No results message -->
				{#if activeType.searchable && searchQuery.length >= 2 && !searching && searchResults.length === 0}
					<div
						class="mt-4 py-4 text-center text-surface-600-400"
						transition:slide={{ duration: 200 }}
					>
						{m.common_no_results()}
					</div>
				{/if}

				<!-- Search hint -->
				{#if activeType.searchable && searchQuery.length < 2 && !searching}
					<div class="mt-4 py-4 text-center text-sm text-surface-600-400">
						{m.trace_search_hint()}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
