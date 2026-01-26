<script>
	import { getContext, onMount } from 'svelte';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconChevronDown,
		IconChevronLeft,
		IconChevronRight,
		IconGripVertical
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { CableFiberDataManager } from '$lib/classes/CableFiberDataManager.svelte.js';
	import { DRAG_DROP_CONTEXT_KEY } from '$lib/classes/DragDropManager.svelte.js';

	let { nodeUuid, refreshTrigger = 0, isMobile = false } = $props();

	const dragDropManager = getContext(DRAG_DROP_CONTEXT_KEY);

	const dataManager = new CableFiberDataManager(nodeUuid);

	let collapsed = $state(false);
	let lastRefreshTrigger = $state(0);
	let expandedCables = $state(new Set());
	let expandedBundles = $state(new Map());

	/**
	 * Toggle cable accordion
	 */
	function toggleCable(cableUuid) {
		if (expandedCables.has(cableUuid)) {
			expandedCables.delete(cableUuid);
		} else {
			expandedCables.add(cableUuid);
			dataManager.fetchFibersForCable(cableUuid);
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

	function handleCableDragStart(e, cable) {
		// Get cached fibers synchronously - must be sync for drag data transfer
		const cachedFibers = dataManager.getCachedFibersForCable(cable.uuid);
		dragDropManager?.startCableDrag(e, cable, cachedFibers);
	}

	function handleBundleDragStart(e, cable, bundle) {
		dragDropManager?.startBundleDrag(e, cable, bundle);
	}

	function handleFiberDragStart(e, cable, bundle, fiber) {
		dragDropManager?.startFiberDrag(e, cable, bundle, fiber);
	}

	function handleDragEnd() {
		dragDropManager?.endDrag();
	}

	function handleMobileFiberClick(cable, bundle, fiber) {
		if (isMobile) {
			dragDropManager?.selectMobileFiber(cable, bundle, fiber);
		}
	}

	$effect(() => {
		if (nodeUuid) {
			dataManager.setNodeUuid(nodeUuid);
			expandedCables = new Set();
			expandedBundles = new Map();
			dataManager.fetchCables();
		}
	});

	$effect(() => {
		if (refreshTrigger > lastRefreshTrigger && nodeUuid) {
			lastRefreshTrigger = refreshTrigger;
			dataManager.clearFibersCache();
			dataManager.fetchCables();
		}
	});

	// Listen for cable connection changes from the diagram
	$effect(() => {
		function handleCableConnectionChanged(event) {
			const { nodeIds } = event.detail;
			if (nodeIds && nodeIds.includes(nodeUuid)) {
				dataManager.clearFibersCache();
				dataManager.fetchCables();
			}
		}

		window.addEventListener('cableConnectionChanged', handleCableConnectionChanged);
		return () => {
			window.removeEventListener('cableConnectionChanged', handleCableConnectionChanged);
		};
	});

	onMount(() => {
		dataManager.fetchFiberColors();
		if (nodeUuid) {
			dataManager.fetchCables();
		}
	});
</script>

{#if isMobile}
	<!-- Mobile: Simplified accordion without sidebar wrapper -->
	<div class="space-y-2">
		{#if dataManager.loading}
			<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
		{:else if dataManager.cables.length === 0}
			<div class="text-center py-4 text-surface-500 text-sm">{m.message_no_cables()}</div>
		{:else}
			{#each dataManager.cables as cable (cable.uuid)}
				{@const isExpanded = expandedCables.has(cable.uuid)}
				{@const fibers = dataManager.getFibersForCable(cable.uuid)}
				{@const bundles = dataManager.groupFibersByBundle(fibers)}
				{@const isLoadingFibers = dataManager.isLoadingFibers(cable.uuid)}

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
												style:background-color={dataManager.getColorHex(bundle.bundleColor)}
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
															style:background-color={dataManager.getColorHex(fiber.fiber_color)}
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
	<div
		class="relative border-l border-[var(--color-surface-200-800)] bg-[var(--color-surface-100-900)] transition-all duration-200 ease-in-out flex flex-col"
		style:width={collapsed ? '40px' : '240px'}
		style:min-width={collapsed ? '40px' : '240px'}
	>
		<button
			type="button"
			class="absolute top-2 -left-3 z-10 w-6 h-6 rounded-full bg-[var(--color-surface-100-900)] border border-[var(--color-surface-300-700)] flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-200-800)]"
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
			<div class="flex-1 overflow-y-auto p-2 px-1">
				<h3 class="text-sm font-semibold mb-2 px-2">{m.form_cables()}</h3>

				{#if dataManager.loading}
					<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
				{:else if dataManager.cables.length === 0}
					<div class="text-center py-4 text-surface-500 text-xs">{m.message_no_cables()}</div>
				{:else}
					<div class="flex flex-col gap-1">
						{#each dataManager.cables as cable (cable.uuid)}
							{@const isExpanded = expandedCables.has(cable.uuid)}
							{@const fibers = dataManager.getFibersForCable(cable.uuid)}
							{@const bundles = dataManager.groupFibersByBundle(fibers)}
							{@const isLoadingFibers = dataManager.isLoadingFibers(cable.uuid)}

							<div
								class="bg-[var(--color-surface-100-900)] border border-[var(--color-surface-200-800)] rounded overflow-hidden"
							>
								<div
									class="flex items-center gap-1.5 px-2.5 py-2 cursor-grab transition-colors duration-150 hover:bg-[var(--color-surface-200-800)] active:cursor-grabbing"
									draggable="true"
									ondragstart={(e) => handleCableDragStart(e, cable)}
									ondragend={handleDragEnd}
									role="button"
									tabindex="0"
								>
									<IconGripVertical size={14} class="text-surface-400 flex-shrink-0 cursor-grab" />
									<button
										type="button"
										class="p-0.5 bg-transparent border-none cursor-pointer flex items-center justify-center"
										onclick={() => toggleCable(cable.uuid)}
									>
										<IconChevronDown
											size={14}
											class="transition-transform {isExpanded ? 'rotate-0' : '-rotate-90'}"
										/>
									</button>
									<div class="flex-1 min-w-0">
										<div
											class="text-sm font-medium flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis"
										>
											{cable.name}
											{#if cable.direction === 'start'}
												<IconArrowRight size={12} />
											{:else}
												<IconArrowLeft size={12} />
											{/if}
										</div>
										<div class="text-xs text-[var(--color-surface-950-50)]">
											{cable.fiber_count}
											{m.form_fibers()}
										</div>
									</div>
								</div>

								{#if isExpanded}
									<div
										class="border-t border-[var(--color-surface-200-800)] p-1 bg-[var(--color-surface-100-900)]"
									>
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
												<div class="mb-0.5">
													<div
														class="flex items-center gap-1.5 px-2 py-1.5 cursor-grab rounded transition-colors duration-150 hover:bg-[var(--color-surface-200-800)] active:cursor-grabbing"
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
															class="p-0.5 bg-transparent border-none cursor-pointer flex items-center justify-center"
															onclick={() => toggleBundle(cable.uuid, bundle.bundleNumber)}
														>
															<IconChevronDown
																size={12}
																class="transition-transform {isBundleOpen
																	? 'rotate-0'
																	: '-rotate-90'}"
															/>
														</button>
														<span
															class="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
															style:background-color={dataManager.getColorHex(bundle.bundleColor)}
														></span>
														<div class="flex-1 min-w-0">
															<span class="text-[0.8125rem] font-medium">
																{m.form_bundle()}
																{bundle.bundleNumber}
															</span>
															<span class="text-xs text-[var(--color-surface-500)] ml-1"
																>({bundle.fibers.length})</span
															>
														</div>
													</div>

													{#if isBundleOpen}
														<div class="pl-5 pt-1">
															{#each bundle.fibers as fiber (fiber.uuid)}
																<!-- Fiber item -->
																<div
																	class="flex items-center gap-1.5 px-2 py-1.5 cursor-grab rounded-sm transition-colors duration-150 hover:bg-[var(--color-surface-200-800)] active:cursor-grabbing"
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
																		class="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-black/10"
																		style:background-color={dataManager.getColorHex(
																			fiber.fiber_color
																		)}
																	></span>
																	<span class="text-[0.8125rem] font-mono">
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
