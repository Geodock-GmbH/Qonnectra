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
	import { tooltip } from '$lib/utils/tooltip.js';

	let { nodeUuid, refreshTrigger = 0, isMobile = false, readonly = false } = $props();

	const dragDropManager = getContext(DRAG_DROP_CONTEXT_KEY);

	const dataManager = new CableFiberDataManager();

	let collapsed = $state(false);
	let lastRefreshTrigger = $state(0);
	let expandedCables = $state(new Set());
	let expandedBundles = $state(new Map());
	let expandedAddresses = $state(new Set());

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
		if (readonly) {
			e.preventDefault();
			return;
		}
		// Get cached fibers synchronously - must be sync for drag data transfer
		const cachedFibers = dataManager.getCachedFibersForCable(cable.uuid);
		dragDropManager?.startCableDrag(e, cable, cachedFibers);
	}

	function handleBundleDragStart(e, cable, bundle) {
		if (readonly) {
			e.preventDefault();
			return;
		}
		dragDropManager?.startBundleDrag(e, cable, bundle);
	}

	function handleFiberDragStart(e, cable, bundle, fiber) {
		if (readonly) {
			e.preventDefault();
			return;
		}
		dragDropManager?.startFiberDrag(e, cable, bundle, fiber);
	}

	function handleDragEnd() {
		if (readonly) return;
		dragDropManager?.endDrag();
	}

	function handleMobileFiberClick(cable, bundle, fiber) {
		if (readonly) return;
		if (isMobile) {
			dragDropManager?.selectMobileFiber(cable, bundle, fiber);
		}
	}

	/**
	 * Toggle address accordion
	 */
	function toggleAddress(addressUuid) {
		if (expandedAddresses.has(addressUuid)) {
			expandedAddresses.delete(addressUuid);
		} else {
			expandedAddresses.add(addressUuid);
		}
		expandedAddresses = new Set(expandedAddresses);
	}

	function handleAddressDragStart(e, address) {
		if (readonly) {
			e.preventDefault();
			return;
		}
		dragDropManager?.startAddressDrag(e, address, address.residential_units || []);
	}

	function handleResidentialUnitDragStart(e, address, unit) {
		if (readonly) {
			e.preventDefault();
			return;
		}
		dragDropManager?.startResidentialUnitDrag(e, address, unit);
	}

	function handleMobileResidentialUnitClick(address, unit) {
		if (readonly) return;
		if (isMobile) {
			dragDropManager?.selectMobileResidentialUnit(address, unit);
		}
	}

	$effect(() => {
		if (nodeUuid) {
			dataManager.setNodeUuid(nodeUuid);
			expandedCables = new Set();
			expandedBundles = new Map();
			expandedAddresses = new Set();
			dataManager.fetchCables();
			dataManager.fetchFiberUsage();
			dataManager.fetchAddresses();
			dataManager.fetchResidentialUnitUsage();
		}
	});

	$effect(() => {
		if (refreshTrigger > lastRefreshTrigger && nodeUuid) {
			lastRefreshTrigger = refreshTrigger;
			dataManager.clearFibersCache();
			dataManager.fetchCables();
			dataManager.fetchFiberUsage();
			dataManager.fetchAddresses();
			dataManager.fetchResidentialUnitUsage();
		}
	});

	// Listen for cable connection changes from the diagram
	$effect(() => {
		function handleCableConnectionChanged(event) {
			const { nodeIds } = event.detail;
			if (nodeIds && nodeIds.includes(nodeUuid)) {
				dataManager.clearFibersCache();
				dataManager.fetchCables();
				dataManager.fetchFiberUsage();
			}
		}

		window.addEventListener('cableConnectionChanged', handleCableConnectionChanged);
		return () => {
			window.removeEventListener('cableConnectionChanged', handleCableConnectionChanged);
		};
	});

	// Listen for fiber splice changes to refresh usage indicators
	$effect(() => {
		function handleFiberSpliceChanged() {
			if (nodeUuid) {
				dataManager.fetchFiberUsage();
			}
		}

		window.addEventListener('fiberSpliceChanged', handleFiberSpliceChanged);
		return () => {
			window.removeEventListener('fiberSpliceChanged', handleFiberSpliceChanged);
		};
	});

	// Listen for residential unit splice changes to refresh usage indicators
	$effect(() => {
		function handleResidentialUnitSpliceChanged() {
			if (nodeUuid) {
				dataManager.fetchResidentialUnitUsage();
			}
		}

		window.addEventListener('residentialUnitSpliceChanged', handleResidentialUnitSpliceChanged);
		return () => {
			window.removeEventListener(
				'residentialUnitSpliceChanged',
				handleResidentialUnitSpliceChanged
			);
		};
	});

	onMount(() => {
		dataManager.fetchFiberColors();
		if (nodeUuid) {
			dataManager.fetchCables();
			dataManager.fetchFiberUsage();
			dataManager.fetchAddresses();
			dataManager.fetchResidentialUnitUsage();
		}
	});
</script>

{#if isMobile}
	<div class="space-y-2">
		{#if dataManager.loading}
			<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
		{:else if dataManager.cables.length === 0 && dataManager.addresses.length === 0}
			<div class="text-center py-4 text-surface-500 text-sm">{m.message_no_cables()}</div>
		{:else}
			{#each dataManager.cables as cable (cable.uuid)}
				{@const isExpanded = expandedCables.has(cable.uuid)}
				{@const fibers = dataManager.getFibersForCable(cable.uuid)}
				{@const bundles = dataManager.groupFibersByBundle(fibers)}
				{@const isLoadingFibers = dataManager.isLoadingFibers(cable.uuid)}

				<div class="rounded-lg border border-surface-300-700 bg-surface-200-800 overflow-hidden">
					<button
						type="button"
						class="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-300-700 transition-colors"
						onclick={() => toggleCable(cable.uuid)}
					>
						<IconChevronDown
							size={18}
							class="transition-transform shrink-0 {isExpanded ? 'rotate-0' : '-rotate-90'}"
						/>
						<div class="flex-1 min-w-0">
							<div class="font-medium flex items-center gap-2" {@attach tooltip(cable.name)}>
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
									{@const bundleFullyUsed = dataManager.isBundleFullyUsed(bundle.fibers)}

									<div class="border-b border-surface-200-800 last:border-b-0">
										<button
											type="button"
											class="w-full flex items-center gap-2 px-4 py-2 text-left transition-colors {bundleFullyUsed
												? 'bg-success-100 dark:bg-success-900/30 hover:bg-success-200 dark:hover:bg-success-900/50'
												: 'hover:bg-surface-200-800'}"
											onclick={() => toggleBundle(cable.uuid, bundle.bundleNumber)}
										>
											<IconChevronDown
												size={14}
												class="transition-transform shrink-0 {isBundleOpen
													? 'rotate-0'
													: '-rotate-90'}"
											/>
											<span
												class="w-4 h-4 rounded-full shrink-0 border border-white/20"
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
													{@const fiberUsed = dataManager.isFiberUsed(fiber.uuid)}
													{@const isDefective = fiber.fiber_status != null}
													<button
														type="button"
														class="w-full flex items-center gap-2 px-3 py-2 text-left rounded-md transition-colors {fiberUsed
															? 'bg-success-100 dark:bg-success-900/30 hover:bg-success-200 dark:hover:bg-success-900/50'
															: 'hover:bg-primary-100 dark:hover:bg-primary-900/30'}"
														onclick={() => handleMobileFiberClick(cable, bundle, fiber)}
														{@attach isDefective
															? tooltip(fiber.fiber_status?.fiber_status)
															: undefined}
													>
														<span
															class="w-3 h-3 rounded-full shrink-0 border border-white/20 {isDefective
																? 'opacity-50'
																: ''}"
															style:background-color={dataManager.getColorHex(fiber.fiber_color)}
														></span>
														<span
															class="text-sm font-mono {isDefective
																? 'line-through text-error-500 opacity-60'
																: ''}">{fiber.fiber_number_absolute}</span
														>
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

			{#if dataManager.addresses.length > 0}
				<div class="mt-4 pt-4 border-t border-surface-300-700">
					<h4 class="text-sm font-semibold mb-2 px-1 flex items-center gap-2">
						{m.form_addresses?.() || 'Addresses'}
					</h4>
					{#each dataManager.addresses as address (address.uuid)}
						{@const isExpanded = expandedAddresses.has(address.uuid)}
						{@const units = address.residential_units || []}

						<div
							class="rounded-lg border border-surface-300-700 bg-surface-200-800 overflow-hidden mb-2"
						>
							<button
								type="button"
								class="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-300-700 transition-colors"
								onclick={() => toggleAddress(address.uuid)}
							>
								<IconChevronDown
									size={18}
									class="transition-transform shrink-0 {isExpanded ? 'rotate-0' : '-rotate-90'}"
								/>
								<div class="flex-1 min-w-0">
									<div class="font-medium">{dataManager.getAddressDisplay(address)}</div>
									<div class="text-sm text-surface-500">
										{units.length}
										{m.form_residential_units?.() || 'Units'}
									</div>
								</div>
							</button>

							{#if isExpanded}
								<div class="border-t border-surface-300-700 bg-surface-100-900 p-2">
									{#each units as unit (unit.uuid)}
										{@const unitUsed = dataManager.isResidentialUnitUsed(unit.uuid)}
										<button
											type="button"
											class="w-full flex items-center gap-2 px-3 py-2 text-left rounded-md transition-colors {unitUsed
												? 'bg-success-100 dark:bg-success-900/30 hover:bg-success-200 dark:hover:bg-success-900/50'
												: 'hover:bg-primary-100 dark:hover:bg-primary-900/30'}"
											onclick={() => handleMobileResidentialUnitClick(address, unit)}
										>
											<span class="text-sm">
												{dataManager.getResidentialUnitDisplayName(unit)}
											</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{:else}
	<div
		class="relative border-l border-(--color-surface-200-800) bg-(--color-surface-100-900) transition-all duration-200 ease-in-out flex flex-col"
		style:width={collapsed ? '40px' : '240px'}
		style:min-width={collapsed ? '40px' : '240px'}
	>
		<button
			type="button"
			class="absolute top-2 -left-3 z-10 w-6 h-6 rounded-full bg-(--color-surface-100-900) border border-(--color-surface-300-700) flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-(--color-surface-200-800)"
			onclick={() => (collapsed = !collapsed)}
			aria-label={collapsed ? m.action_expand() : m.action_collapse()}
			{@attach tooltip(collapsed ? m.action_expand() : m.action_collapse())}
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
								class="bg-(--color-surface-100-900) border border-(--color-surface-200-800) rounded overflow-hidden"
							>
								<div
									class="flex items-center gap-1.5 px-2.5 py-2 transition-colors duration-150 hover:bg-(--color-surface-200-800) {readonly
										? ''
										: 'cursor-grab active:cursor-grabbing'}"
									draggable={!readonly}
									ondragstart={(e) => handleCableDragStart(e, cable)}
									ondragend={handleDragEnd}
									role="button"
									tabindex="0"
								>
									{#if !readonly}
										<IconGripVertical size={14} class="text-surface-400 shrink-0 cursor-grab" />
									{/if}
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
											{@attach tooltip(cable.name)}
										>
											{cable.name}
											{#if cable.direction === 'start'}
												<IconArrowRight size={12} />
											{:else}
												<IconArrowLeft size={12} />
											{/if}
										</div>
										<div class="text-xs text-(--color-surface-950-50)">
											{cable.fiber_count}
											{m.form_fibers()}
										</div>
									</div>
								</div>

								{#if isExpanded}
									<div
										class="border-t border-(--color-surface-200-800) p-1 bg-(--color-surface-100-900)"
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
												{@const bundleFullyUsed = dataManager.isBundleFullyUsed(bundle.fibers)}

												<div class="mb-0.5">
													<div
														class="flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors duration-150 {readonly
															? ''
															: 'cursor-grab active:cursor-grabbing'} {bundleFullyUsed
															? 'bg-success-100 dark:bg-success-900/30 hover:bg-success-200 dark:hover:bg-success-900/50'
															: 'hover:bg-(--color-surface-200-800)'}"
														draggable={!readonly}
														ondragstart={(e) => handleBundleDragStart(e, cable, bundle)}
														ondragend={handleDragEnd}
														role="button"
														tabindex="0"
													>
														{#if !readonly}
															<IconGripVertical
																size={12}
																class="text-surface-400 shrink-0 cursor-grab"
															/>
														{/if}
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
															class="w-3 h-3 rounded-full shrink-0 border border-black/10"
															style:background-color={dataManager.getColorHex(bundle.bundleColor)}
														></span>
														<div class="flex-1 min-w-0">
															<span class="text-[0.8125rem] font-medium">
																{m.form_bundle()}
																{bundle.bundleNumber}
															</span>
															<span class="text-xs text-(--color-surface-500) ml-1"
																>({bundle.fibers.length})</span
															>
														</div>
													</div>

													{#if isBundleOpen}
														<div class="pl-5 pt-1">
															{#each bundle.fibers as fiber (fiber.uuid)}
																{@const fiberUsed = dataManager.isFiberUsed(fiber.uuid)}
																{@const isDefective = fiber.fiber_status != null}
																<div
																	class="flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors duration-150 {readonly
																		? ''
																		: 'cursor-grab active:cursor-grabbing'} {fiberUsed
																		? 'bg-success-100 dark:bg-success-900/30 hover:bg-success-200 dark:hover:bg-success-900/50'
																		: 'hover:bg-(--color-surface-200-800)'}"
																	draggable={!readonly}
																	ondragstart={(e) => handleFiberDragStart(e, cable, bundle, fiber)}
																	ondragend={handleDragEnd}
																	role="listitem"
																	{@attach isDefective
																		? tooltip(fiber.fiber_status?.fiber_status)
																		: undefined}
																>
																	{#if !readonly}
																		<IconGripVertical
																			size={12}
																			class="text-surface-400 shrink-0 cursor-grab"
																		/>
																	{/if}
																	<span
																		class="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 {isDefective
																			? 'opacity-50'
																			: ''}"
																		style:background-color={dataManager.getColorHex(
																			fiber.fiber_color
																		)}
																	></span>
																	<span
																		class="text-[0.8125rem] font-mono {isDefective
																			? 'line-through text-error-500 opacity-60'
																			: ''}"
																	>
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

				{#if dataManager.addresses.length > 0}
					<div class="mt-4 pt-4 border-t border-(--color-surface-200-800)">
						<h3 class="text-sm font-semibold mb-2 px-2 flex items-center gap-2">
							{m.form_addresses?.() || 'Addresses'}
						</h3>

						<div class="flex flex-col gap-1">
							{#each dataManager.addresses as address (address.uuid)}
								{@const isExpanded = expandedAddresses.has(address.uuid)}
								{@const units = address.residential_units || []}

								<div
									class="bg-(--color-surface-100-900) border border-(--color-surface-200-800) rounded overflow-hidden"
								>
									<div
										class="flex items-center gap-1.5 px-2.5 py-2 transition-colors duration-150 hover:bg-(--color-surface-200-800) {readonly
											? ''
											: 'cursor-grab active:cursor-grabbing'}"
										draggable={!readonly}
										ondragstart={(e) => handleAddressDragStart(e, address)}
										ondragend={handleDragEnd}
										role="button"
										tabindex="0"
									>
										{#if !readonly}
											<IconGripVertical size={14} class="text-surface-400 shrink-0 cursor-grab" />
										{/if}
										<button
											type="button"
											class="p-0.5 bg-transparent border-none cursor-pointer flex items-center justify-center"
											onclick={() => toggleAddress(address.uuid)}
										>
											<IconChevronDown
												size={14}
												class="transition-transform {isExpanded ? 'rotate-0' : '-rotate-90'}"
											/>
										</button>
										<div class="flex-1 min-w-0">
											<div
												class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis"
											>
												{dataManager.getAddressDisplay(address)}
											</div>
											<div class="text-xs text-(--color-surface-950-50)">
												{units.length}
												{m.form_residential_units?.() || 'Units'}
											</div>
										</div>
									</div>

									{#if isExpanded}
										<div
											class="border-t border-(--color-surface-200-800) p-1 bg-(--color-surface-100-900)"
										>
											{#each units as unit (unit.uuid)}
												{@const unitUsed = dataManager.isResidentialUnitUsed(unit.uuid)}
												<div
													class="flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors duration-150 {readonly
														? ''
														: 'cursor-grab active:cursor-grabbing'} {unitUsed
														? 'bg-success-100 dark:bg-success-900/30 hover:bg-success-200 dark:hover:bg-success-900/50'
														: 'hover:bg-(--color-surface-200-800)'}"
													draggable={!readonly}
													ondragstart={(e) => handleResidentialUnitDragStart(e, address, unit)}
													ondragend={handleDragEnd}
													role="listitem"
												>
													{#if !readonly}
														<IconGripVertical
															size={12}
															class="text-surface-400 shrink-0 cursor-grab"
														/>
													{/if}
													<span class="text-[0.8125rem]">
														{dataManager.getResidentialUnitDisplayName(unit)}
													</span>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
