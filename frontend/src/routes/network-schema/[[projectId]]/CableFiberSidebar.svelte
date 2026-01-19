<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconChevronDown,
		IconChevronLeft,
		IconChevronRight,
		IconGripVertical
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		nodeUuid,
		onDragStart = () => {},
		onDragEnd = () => {},
		refreshTrigger = 0,
		isMobile = false,
		onMobileSelect = () => {}
	} = $props();

	// State
	let cables = $state([]);
	let fiberColors = $state([]);
	let loading = $state(true);
	let collapsed = $state(false);
	let lastRefreshTrigger = $state(0);

	// Expanded state for accordions
	let expandedCables = $state(new Set());
	let expandedBundles = $state(new Map()); // Map<cableUuid, Set<bundleNumber>>

	// Fibers cache per cable
	let fibersCache = $state(new Map()); // Map<cableUuid, fiber[]>
	let loadingFibers = $state(new Set()); // Set of cable UUIDs currently loading

	// Color lookup map
	const colorMap = $derived.by(() => {
		const map = new Map();
		for (const color of fiberColors) {
			map.set(color.name_de, color.hex_code);
			map.set(color.name_en, color.hex_code);
		}
		return map;
	});

	/**
	 * Fetch cables at the node
	 */
	async function fetchCables() {
		if (!nodeUuid) return;

		loading = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);

			const response = await fetch('?/getCablesAtNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				cables = result.data?.cables || [];
			}
		} catch (err) {
			console.error('Error fetching cables:', err);
		} finally {
			loading = false;
		}
	}

	/**
	 * Fetch fiber colors
	 */
	async function fetchFiberColors() {
		try {
			const response = await fetch('?/getFiberColors', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				fiberColors = result.data?.fiberColors || [];
			}
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
		}
	}

	/**
	 * Fetch fibers for a cable (lazy loading)
	 */
	async function fetchFibersForCable(cableUuid) {
		if (fibersCache.has(cableUuid) || loadingFibers.has(cableUuid)) return;

		loadingFibers.add(cableUuid);
		loadingFibers = new Set(loadingFibers);

		try {
			const formData = new FormData();
			formData.append('cableUuid', cableUuid);

			const response = await fetch('?/getFibersForCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success') {
				fibersCache.set(cableUuid, result.data?.fibers || []);
				fibersCache = new Map(fibersCache);
			}
		} catch (err) {
			console.error('Error fetching fibers:', err);
		} finally {
			loadingFibers.delete(cableUuid);
			loadingFibers = new Set(loadingFibers);
		}
	}

	/**
	 * Group fibers by bundle number
	 */
	function groupFibersByBundle(fibers) {
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
	}

	/**
	 * Get color hex code from color name
	 */
	function getColorHex(colorName) {
		return colorMap.get(colorName) || '#999999';
	}

	/**
	 * Toggle cable accordion
	 */
	function toggleCable(cableUuid) {
		if (expandedCables.has(cableUuid)) {
			expandedCables.delete(cableUuid);
		} else {
			expandedCables.add(cableUuid);
			// Load fibers when expanding
			fetchFibersForCable(cableUuid);
		}
		expandedCables = new Set(expandedCables);
	}

	/**
	 * Toggle bundle accordion
	 */
	function toggleBundle(cableUuid, bundleNumber) {
		if (!expandedBundles.has(cableUuid)) {
			expandedBundles.set(cableUuid, new Set());
		}
		const bundleSet = expandedBundles.get(cableUuid);
		if (bundleSet.has(bundleNumber)) {
			bundleSet.delete(bundleNumber);
		} else {
			bundleSet.add(bundleNumber);
		}
		expandedBundles = new Map(expandedBundles);
	}

	/**
	 * Check if bundle is expanded
	 */
	function isBundleExpanded(cableUuid, bundleNumber) {
		return expandedBundles.get(cableUuid)?.has(bundleNumber) ?? false;
	}

	// Drag handlers for cable
	function handleCableDragStart(e, cable) {
		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: 'cable',
				uuid: cable.uuid,
				name: cable.name,
				fiber_count: cable.fiber_count,
				direction: cable.direction
			})
		);
		e.dataTransfer.effectAllowed = 'copy';
		onDragStart({ type: 'cable', cable });
	}

	// Drag handlers for bundle
	function handleBundleDragStart(e, cable, bundle) {
		e.stopPropagation();
		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: 'bundle',
				cable_uuid: cable.uuid,
				cable_name: cable.name,
				bundle_number: bundle.bundleNumber,
				bundle_color: bundle.bundleColor,
				fiber_count: bundle.fibers.length
			})
		);
		e.dataTransfer.effectAllowed = 'copy';
		onDragStart({ type: 'bundle', cable, bundle });
	}

	// Drag handlers for fiber
	function handleFiberDragStart(e, cable, bundle, fiber) {
		e.stopPropagation();
		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: 'fiber',
				uuid: fiber.uuid,
				cable_uuid: cable.uuid,
				cable_name: cable.name,
				bundle_number: fiber.bundle_number,
				fiber_number: fiber.fiber_number_absolute,
				fiber_color: fiber.fiber_color
			})
		);
		e.dataTransfer.effectAllowed = 'copy';
		onDragStart({ type: 'fiber', cable, bundle, fiber });
	}

	function handleDragEnd() {
		onDragEnd();
	}

	function handleMobileFiberClick(cable, bundle, fiber) {
		if (isMobile) {
			onMobileSelect({
				type: 'fiber',
				uuid: fiber.uuid,
				cable_uuid: cable.uuid,
				cable_name: cable.name,
				bundle_number: fiber.bundle_number,
				fiber_number: fiber.fiber_number_absolute,
				fiber_color: fiber.fiber_color,
				name: `${cable.name} - Fiber ${fiber.fiber_number_absolute}`
			});
		}
	}

	// Re-fetch when nodeUuid changes
	$effect(() => {
		if (nodeUuid) {
			// Reset state
			cables = [];
			fibersCache = new Map();
			expandedCables = new Set();
			expandedBundles = new Map();
			fetchCables();
		}
	});

	// Re-fetch when refreshTrigger changes (panel opened)
	$effect(() => {
		if (refreshTrigger > lastRefreshTrigger && nodeUuid) {
			lastRefreshTrigger = refreshTrigger;
			// Clear fibers cache to get fresh data
			fibersCache = new Map();
			fetchCables();
		}
	});

	onMount(() => {
		fetchFiberColors();
		if (nodeUuid) {
			fetchCables();
		}
	});
</script>

{#if isMobile}
	<!-- Mobile: Simplified accordion without sidebar wrapper -->
	<div class="space-y-2">
		{#if loading}
			<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
		{:else if cables.length === 0}
			<div class="text-center py-4 text-surface-500 text-sm">{m.message_no_cables()}</div>
		{:else}
			{#each cables as cable (cable.uuid)}
				{@const isExpanded = expandedCables.has(cable.uuid)}
				{@const fibers = fibersCache.get(cable.uuid) || []}
				{@const bundles = groupFibersByBundle(fibers)}
				{@const isLoadingFibers = loadingFibers.has(cable.uuid)}

				<div class="rounded-lg border border-surface-300-700 bg-surface-200-800 overflow-hidden">
					<!-- Cable Header -->
					<button
						type="button"
						class="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-300-700 transition-colors"
						onclick={() => toggleCable(cable.uuid)}
					>
						<IconChevronDown
							size={18}
							class="transition-transform flex-shrink-0 {isExpanded ? 'rotate-0' : '-rotate-90'}"
						/>
						<div class="flex-1 min-w-0">
							<div class="font-medium flex items-center gap-2">
								{cable.name}
								{#if cable.direction === 'start'}
									<IconArrowRight size={14} class="text-surface-500" />
								{:else}
									<IconArrowLeft size={14} class="text-surface-500" />
								{/if}
							</div>
							<div class="text-sm text-surface-500">{cable.fiber_count} {m.form_fibers()}</div>
						</div>
					</button>

					{#if isExpanded}
						<div class="border-t border-surface-300-700 bg-surface-100-900">
							{#if isLoadingFibers}
								<div class="text-center py-3 text-surface-500 text-sm">{m.common_loading()}</div>
							{:else if bundles.length === 0}
								<div class="text-center py-3 text-surface-500 text-sm">{m.message_no_fibers()}</div>
							{:else}
								{#each bundles as bundle (bundle.bundleNumber)}
									{@const isBundleOpen = isBundleExpanded(cable.uuid, bundle.bundleNumber)}

									<div class="border-b border-surface-200-800 last:border-b-0">
										<!-- Bundle Header -->
										<button
											type="button"
											class="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-surface-200-800 transition-colors"
											onclick={() => toggleBundle(cable.uuid, bundle.bundleNumber)}
										>
											<IconChevronDown
												size={14}
												class="transition-transform flex-shrink-0 {isBundleOpen
													? 'rotate-0'
													: '-rotate-90'}"
											/>
											<span
												class="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
												style:background-color={getColorHex(bundle.bundleColor)}
											></span>
											<span class="text-sm font-medium">
												{m.form_bundle()}
												{bundle.bundleNumber}
											</span>
											<span class="text-xs text-surface-500">({bundle.fibers.length})</span>
										</button>

										{#if isBundleOpen}
											<div class="pl-8 pb-2">
												{#each bundle.fibers as fiber (fiber.uuid)}
													<button
														type="button"
														class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-md transition-colors"
														onclick={() => handleMobileFiberClick(cable, bundle, fiber)}
													>
														<span
															class="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
															style:background-color={getColorHex(fiber.fiber_color)}
														></span>
														<span class="text-sm font-mono">{fiber.fiber_number_absolute}</span>
													</button>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
{:else}
	<!-- Desktop: Original sidebar -->
	<div class="cable-fiber-sidebar" class:collapsed>
		<button
			type="button"
			class="toggle-btn"
			onclick={() => (collapsed = !collapsed)}
			title={collapsed ? m.action_expand() : m.action_collapse()}
		>
			{#if collapsed}
				<IconChevronLeft size={16} />
			{:else}
				<IconChevronRight size={16} />
			{/if}
		</button>

		{#if !collapsed}
			<div class="sidebar-content">
				<h3 class="text-sm font-semibold mb-2 px-2">{m.form_cables()}</h3>

				{#if loading}
					<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
				{:else if cables.length === 0}
					<div class="text-center py-4 text-surface-500 text-xs">{m.message_no_cables()}</div>
				{:else}
					<div class="cable-list">
						{#each cables as cable (cable.uuid)}
							{@const isExpanded = expandedCables.has(cable.uuid)}
							{@const fibers = fibersCache.get(cable.uuid) || []}
							{@const bundles = groupFibersByBundle(fibers)}
							{@const isLoadingFibers = loadingFibers.has(cable.uuid)}

							<!-- Cable accordion -->
							<div class="cable-item">
								<div
									class="cable-header"
									draggable="true"
									ondragstart={(e) => handleCableDragStart(e, cable)}
									ondragend={handleDragEnd}
									role="button"
									tabindex="0"
								>
									<IconGripVertical size={14} class="text-surface-400 flex-shrink-0 cursor-grab" />
									<button type="button" class="expand-btn" onclick={() => toggleCable(cable.uuid)}>
										<IconChevronDown
											size={14}
											class="chevron transition-transform {isExpanded ? 'rotate-0' : '-rotate-90'}"
										/>
									</button>
									<div class="flex-1 min-w-0">
										<div class="cable-name">
											{cable.name}
											{#if cable.direction === 'start'}
												<IconArrowRight size={12} class="direction-icon" />
											{:else}
												<IconArrowLeft size={12} class="direction-icon" />
											{/if}
										</div>
										<div class="cable-info">
											{cable.fiber_count}
											{m.form_fibers()}
										</div>
									</div>
								</div>

								{#if isExpanded}
									<div class="cable-content">
										{#if isLoadingFibers}
											<div class="text-center py-2 text-surface-500 text-xs">
												{m.common_loading()}
											</div>
										{:else if bundles.length === 0}
											<div class="text-center py-2 text-surface-500 text-xs">
												{m.message_no_fibers()}
											</div>
										{:else}
											{#each bundles as bundle (bundle.bundleNumber)}
												{@const isBundleOpen = isBundleExpanded(cable.uuid, bundle.bundleNumber)}

												<!-- Bundle accordion -->
												<div class="bundle-item">
													<div
														class="bundle-header"
														draggable="true"
														ondragstart={(e) => handleBundleDragStart(e, cable, bundle)}
														ondragend={handleDragEnd}
														role="button"
														tabindex="0"
													>
														<IconGripVertical
															size={12}
															class="text-surface-400 flex-shrink-0 cursor-grab"
														/>
														<button
															type="button"
															class="expand-btn"
															onclick={() => toggleBundle(cable.uuid, bundle.bundleNumber)}
														>
															<IconChevronDown
																size={12}
																class="chevron transition-transform {isBundleOpen
																	? 'rotate-0'
																	: '-rotate-90'}"
															/>
														</button>
														<span
															class="color-dot"
															style:background-color={getColorHex(bundle.bundleColor)}
														></span>
														<div class="flex-1 min-w-0">
															<span class="bundle-name">
																{m.form_bundle()}
																{bundle.bundleNumber}
															</span>
															<span class="bundle-info">({bundle.fibers.length})</span>
														</div>
													</div>

													{#if isBundleOpen}
														<div class="bundle-content">
															{#each bundle.fibers as fiber (fiber.uuid)}
																<!-- Fiber item -->
																<div
																	class="fiber-item"
																	draggable="true"
																	ondragstart={(e) => handleFiberDragStart(e, cable, bundle, fiber)}
																	ondragend={handleDragEnd}
																	role="listitem"
																>
																	<IconGripVertical
																		size={12}
																		class="text-surface-400 flex-shrink-0 cursor-grab"
																	/>
																	<span
																		class="color-dot small"
																		style:background-color={getColorHex(fiber.fiber_color)}
																	></span>
																	<span class="fiber-number">
																		{fiber.fiber_number_absolute}
																	</span>
																</div>
															{/each}
														</div>
													{/if}
												</div>
											{/each}
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.cable-fiber-sidebar {
		position: relative;
		width: 240px;
		min-width: 240px;
		border-left: 1px solid rgb(var(--color-surface-200));
		background: rgb(var(--color-surface-50));
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
	}

	:global([data-mode='dark']) .cable-fiber-sidebar {
		border-left-color: rgb(var(--color-surface-700));
		background: rgb(var(--color-surface-900));
	}

	.cable-fiber-sidebar.collapsed {
		width: 40px;
		min-width: 40px;
	}

	.toggle-btn {
		position: absolute;
		top: 8px;
		left: -12px;
		z-index: 10;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.toggle-btn:hover {
		background: rgb(var(--color-surface-200));
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 4px;
	}

	.cable-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cable-item {
		background: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-200));
		border-radius: 4px;
		overflow: hidden;
	}

	.cable-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		cursor: grab;
		transition: background-color 0.15s;
	}

	.cable-header:hover {
		background: rgb(var(--color-surface-200));
	}

	.cable-header:active {
		cursor: grabbing;
	}

	.expand-btn {
		padding: 2px;
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cable-name {
		font-size: 0.875rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cable-info {
		font-size: 0.75rem;
		color: rgb(var(--color-surface-500));
	}

	.cable-content {
		border-top: 1px solid rgb(var(--color-surface-200));
		padding: 4px;
		background: rgb(var(--color-surface-50));
	}

	.bundle-item {
		margin-bottom: 2px;
	}

	.bundle-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		cursor: grab;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.bundle-header:hover {
		background: rgb(var(--color-surface-200));
	}

	.bundle-header:active {
		cursor: grabbing;
	}

	.bundle-name {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.bundle-info {
		font-size: 0.75rem;
		color: rgb(var(--color-surface-500));
		margin-left: 4px;
	}

	.bundle-content {
		padding-left: 20px;
		padding-top: 4px;
	}

	.fiber-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		cursor: grab;
		border-radius: 3px;
		transition: background-color 0.15s;
	}

	.fiber-item:hover {
		background: rgb(var(--color-surface-200));
	}

	.fiber-item:active {
		cursor: grabbing;
	}

	.fiber-number {
		font-size: 0.8125rem;
		font-family: monospace;
	}

	.color-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.color-dot.small {
		width: 10px;
		height: 10px;
	}
</style>
