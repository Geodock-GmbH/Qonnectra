<script>
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import {
		IconBuildingSkyscraper,
		IconChevronDown,
		IconLoader2,
		IconMapPin,
		IconNetwork,
		IconPlug,
		IconRouter,
		IconSearch,
		IconX
	} from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

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
			icon: IconBuildingSkyscraper,
			color: 'text-secondary-500',
			searchable: true,
			searchPlaceholder: () => m.trace_search_ru_placeholder()
		},
		{
			value: 'fiber',
			label: () => m.form_fiber(),
			icon: IconNetwork,
			color: 'text-primary-500',
			searchable: true,
			searchPlaceholder: () => m.trace_search_cable_placeholder()
		}
	];

	let activeTab = $state('address');
	let searchQuery = $state('');
	let searchResults = $state([]);
	let searching = $state(false);
	let searchTimeout = $state(null);

	// Geometry options
	let includeGeometry = $state(false);
	let geometryMode = $state('segments');
	let orientGeometry = $state(false);

	// Fiber selection state
	let selectedCable = $state(null);
	let fibers = $state([]);
	let loadingFibers = $state(false);
	let expandedBundles = $state(new Set());
	let fiberColors = $state(new Map());

	// Group fibers by bundle number
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
		// Sort bundles by number
		return Array.from(grouped.values()).sort((a, b) => a.bundleNumber - b.bundleNumber);
	});

	const activeType = $derived(traceTypes.find((t) => t.value === activeTab));

	function handleTabChange(tab) {
		activeTab = tab;
		searchQuery = '';
		searchResults = [];
		// Reset fiber selection when changing tabs
		selectedCable = null;
		fibers = [];
		expandedBundles = new Set();
	}

	async function performSearch(query) {
		if (!query || query.length < 2) {
			searchResults = [];
			return;
		}

		searching = true;
		try {
			let endpoint = '';
			switch (activeTab) {
				case 'address':
					endpoint = `${PUBLIC_API_URL}address/all/?search=${encodeURIComponent(query)}&page_size=20`;
					break;
				case 'node':
					endpoint = `${PUBLIC_API_URL}node/all/?search=${encodeURIComponent(query)}&include_excluded=true`;
					break;
				case 'cable':
				case 'fiber':
					endpoint = `${PUBLIC_API_URL}cable/all/?search=${encodeURIComponent(query)}&page_size=20`;
					break;
				case 'residential_unit':
					endpoint = `${PUBLIC_API_URL}residential-unit/all/?search=${encodeURIComponent(query)}`;
					break;
				default:
					searchResults = [];
					return;
			}

			const response = await fetch(endpoint, { credentials: 'include' });
			if (!response.ok) throw new Error('Search failed');

			const data = await response.json();

			// Handle different response formats
			if (activeTab === 'node') {
				// Node endpoint returns GeoJSON FeatureCollection - uuid is in 'id' field
				const features = data.features || [];
				searchResults = features.slice(0, 20).map((f) => ({
					uuid: f.id,
					name: f.properties?.name,
					node_type: f.properties?.node_type?.node_type
				}));
			} else {
				searchResults = data.results || data || [];
			}
		} catch (err) {
			console.error('Search error:', err);
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	function handleSearchInput(e) {
		const query = e.target.value;
		searchQuery = query;

		if (searchTimeout) clearTimeout(searchTimeout);

		searchTimeout = setTimeout(() => {
			performSearch(query);
		}, 300);
	}

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

	function selectResult(result) {
		const uuid = result.uuid;
		const typeSlug = activeTab === 'residential_unit' ? 'residential-unit' : activeTab;
		goto(buildTraceUrl(typeSlug, uuid));
	}

	async function selectCableForFiber(cable) {
		selectedCable = cable;
		searchQuery = '';
		searchResults = [];
		expandedBundles = new Set();

		// Fetch fibers and colors in parallel
		loadingFibers = true;
		try {
			const [fibersResponse] = await Promise.all([
				fetch(`${PUBLIC_API_URL}fiber/by-cable/${cable.uuid}/`, { credentials: 'include' }),
				fetchFiberColors()
			]);
			if (!fibersResponse.ok) throw new Error('Failed to fetch fibers');
			fibers = await fibersResponse.json();

			// Auto-expand all bundles if there's only one
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

	function clearCableSelection() {
		selectedCable = null;
		fibers = [];
		expandedBundles = new Set();
	}

	function toggleBundle(bundleNumber) {
		const newSet = new Set(expandedBundles);
		if (newSet.has(bundleNumber)) {
			newSet.delete(bundleNumber);
		} else {
			newSet.add(bundleNumber);
		}
		expandedBundles = newSet;
	}

	function traceFiber(fiber) {
		goto(buildTraceUrl('fiber', fiber.uuid));
	}

	function formatAddressResult(result) {
		const parts = [];
		if (result.street) parts.push(result.street);
		if (result.housenumber) parts.push(result.housenumber + (result.house_number_suffix || ''));
		if (result.zip_code || result.city) {
			parts.push(`${result.zip_code || ''} ${result.city || ''}`.trim());
		}
		return parts.join(', ') || result.uuid?.slice(0, 8);
	}

	function formatNodeResult(result) {
		return result.name || result.uuid?.slice(0, 8);
	}

	function formatCableResult(result) {
		return result.name || result.uuid?.slice(0, 8);
	}

	function formatRuResult(result) {
		const parts = [];
		if (result.id_residential_unit) parts.push(result.id_residential_unit);
		if (result.floor !== null && result.floor !== undefined)
			parts.push(`${m.form_floor()} ${result.floor}`);
		if (result.side) parts.push(result.side);
		return parts.join(' - ') || result.uuid?.slice(0, 8);
	}

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

	function getColorHex(colorName) {
		if (!colorName) return '#6b7280';
		return fiberColors.get(colorName.toLowerCase()) || '#6b7280';
	}
</script>

<!-- Tab Selector -->
<div class="mb-6 rounded-xl border border-surface-200-800 p-2">
	<div class="flex flex-wrap gap-2">
		{#each traceTypes as type (type.value)}
			{@const Icon = type.icon}
			<button
				type="button"
				onclick={() => handleTabChange(type.value)}
				class="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 transition-colors {activeTab ===
				type.value
					? 'bg-primary-500 text-white'
					: 'hover:bg-surface-100-900'}"
			>
				<Icon size={20} class={activeTab === type.value ? 'text-white' : type.color} />
				<span class="text-sm font-medium">{type.label()}</span>
			</button>
		{/each}
	</div>
</div>

<!-- Geometry Options -->
<div class="mb-6 rounded-xl border border-surface-200-800 p-4">
	<div class="flex flex-wrap items-center gap-6">
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={includeGeometry}
				class="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
			/>
			<span class="text-sm font-medium text-surface-900-100">{m.trace_include_geometry()}</span>
		</label>

		{#if includeGeometry}
			<div class="flex items-center gap-2" transition:slide={{ duration: 150, axis: 'x' }}>
				<label for="geometryMode" class="text-sm text-surface-600-400"
					>{m.trace_geometry_mode()}:</label
				>
				<select
					id="geometryMode"
					bind:value={geometryMode}
					class="rounded-lg border border-surface-200-800 bg-transparent px-3 py-1.5 text-sm text-surface-900-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
				>
					<option value="segments">{m.trace_geometry_segments()}</option>
					<option value="merged">{m.trace_geometry_merged()}</option>
				</select>
			</div>

			<label
				class="flex cursor-pointer items-center gap-2"
				transition:slide={{ duration: 150, axis: 'x' }}
			>
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
<div class="rounded-xl border border-surface-200-800 p-6">
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
					<div class="py-8 text-center text-surface-600-400">
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
