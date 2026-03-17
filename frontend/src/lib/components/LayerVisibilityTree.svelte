<script>
	import {
		IconChevronDown,
		IconChevronRight,
		IconEye,
		IconEyeOff,
		IconLabel,
		IconLabelFilled,
		IconMoon,
		IconStack2,
		IconSun,
		IconX,
		IconZoomScan
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import {
		DEFAULT_AREA_COLOR,
		DEFAULT_NODE_COLOR,
		DEFAULT_NODE_SIZE,
		DEFAULT_TRENCH_COLOR
	} from '$lib/map/styles';
	import {
		areaTypeStyles,
		basemapTheme,
		getWMSLayerVisibility,
		getWMSSourceExpanded,
		labelVisibilityConfig,
		layerTreeExpanded,
		layerVisibilityConfig,
		nodeTypeStyles,
		setWMSLayerVisibility,
		setWMSSourceExpanded,
		trenchConstructionTypeStyles,
		trenchStyleMode,
		trenchSurfaceStyles,
		wmsLayerVisibilityConfig,
		wmsSourceExpansionState
	} from '$lib/stores/store';
	import { tooltip } from '$lib/utils/tooltip.js';

	/**
	 * @typedef {Object} WMSLayer
	 * @property {string} id
	 * @property {string} name
	 * @property {string} title
	 * @property {boolean} is_enabled
	 * @property {number} sort_order
	 * @property {number} min_zoom
	 * @property {number|null} max_zoom
	 * @property {number} opacity
	 */

	/**
	 * @typedef {Object} WMSSource
	 * @property {string} id
	 * @property {string} name
	 * @property {WMSLayer[]} layers
	 */

	import OpacitySlider from './OpacitySlider.svelte';

	/**
	 * @typedef {Object} MobileOpacitySliderConfig
	 * @property {number} minOpacity
	 * @property {number} maxOpacity
	 * @property {number} stepOpacity
	 * @property {number} opacity
	 * @property {(value: number) => void} onChange
	 */

	let {
		layers = [],
		osmLayer = null,
		nodeTypes = [],
		surfaces = [],
		constructionTypes = [],
		areaTypes = [],
		usingFallbackOSM = false,
		/** @type {WMSSource[]} */
		wmsSources = [],
		projectId = '',
		/** @type {MobileOpacitySliderConfig | null} */
		mobileOpacitySlider = null,
		onLayerVisibilityChanged = () => {},
		onNodeTypeVisibilityChanged = () => {},
		onTrenchTypeVisibilityChanged = () => {},
		onAreaTypeVisibilityChanged = () => {},
		onLabelVisibilityChanged = () => {},
		onZoomToExtent = () => {},
		onWMSLayerVisibilityChanged = () => {}
	} = $props();

	/**
	 * Toggle the basemap theme between light and dark
	 */
	function toggleBasemapTheme() {
		$basemapTheme = $basemapTheme === 'light' ? 'dark' : 'light';
	}

	let layerVisibility = $state(new Map());
	let isNodeSubtypesExpanded = $state(false);
	let isTrenchSubtypesExpanded = $state(false);
	let isAreaSubtypesExpanded = $state(false);

	let isMobileSheetOpen = $state(false);
	let isDragging = $state(false);
	let startY = $state(0);
	let currentTranslate = $state(0);

	let trenchTypes = $derived(
		$trenchStyleMode === 'surface'
			? surfaces
			: $trenchStyleMode === 'construction_type'
				? constructionTypes
				: []
	);

	$effect(() => {
		if (nodeTypes.length > 0) {
			const currentStyles = $nodeTypeStyles;
			let hasNewTypes = false;

			nodeTypes.forEach((nodeType) => {
				if (!currentStyles[nodeType.node_type]) {
					currentStyles[nodeType.node_type] = {
						color: DEFAULT_NODE_COLOR,
						size: DEFAULT_NODE_SIZE,
						visible: true
					};
					hasNewTypes = true;
				}
			});

			if (hasNewTypes) {
				$nodeTypeStyles = { ...currentStyles };
			}
		}
	});

	const LAYER_ORDER = /** @type {Record<string, number>} */ ({
		'address-layer': 1,
		'node-layer': 2,
		'trench-layer': 3,
		'area-layer': 4
	});

	$effect(() => {
		if (areaTypes.length > 0) {
			const currentStyles = $areaTypeStyles;
			let hasNewTypes = false;

			areaTypes.forEach((areaType) => {
				if (!currentStyles[areaType.area_type]) {
					currentStyles[areaType.area_type] = {
						color: DEFAULT_AREA_COLOR,
						visible: true
					};
					hasNewTypes = true;
				}
			});

			if (hasNewTypes) {
				$areaTypeStyles = { ...currentStyles };
			}
		}
	});

	$effect(() => {
		const newVisibility = new Map();

		const sortedLayers = [...layers].sort((a, b) => {
			const aId = a.get('layerId');
			const bId = b.get('layerId');
			const aOrder = LAYER_ORDER[aId] ?? 999;
			const bOrder = LAYER_ORDER[bId] ?? 999;
			return aOrder - bOrder;
		});

		for (const layer of sortedLayers) {
			const layerId = layer.get('layerId');
			const layerName = layer.get('layerName');
			const layerType = layer.get('layerType');

			// Skip WMS layers - they are handled separately in the grouped section
			if (layerType === 'wms') {
				continue;
			}

			if (layerId && layerName) {
				const persistedVisible = $layerVisibilityConfig[layerId] ?? true;
				layer.setVisible(persistedVisible);

				newVisibility.set(layerId, {
					layer: layer,
					visible: persistedVisible,
					name: layerName
				});
			}
		}

		const osmVisible = $layerVisibilityConfig['osm-base-layer'] ?? true;
		if (osmLayer) {
			osmLayer.setVisible(osmVisible);
			newVisibility.set('osm-base-layer', {
				layer: osmLayer,
				visible: osmVisible,
				name: m.common_osm()
			});
		} else {
			newVisibility.set('osm-base-layer', {
				layer: null,
				visible: osmVisible,
				name: m.common_osm()
			});
		}

		layerVisibility = newVisibility;
	});

	/**
	 * Toggle the visibility of a layer
	 * @param {string} layerId - The ID of the layer to toggle
	 */
	function toggleLayerVisibility(layerId) {
		const layerInfo = layerVisibility.get(layerId);
		if (layerInfo) {
			const newVisible = !layerInfo.visible;

			if (layerInfo.layer) {
				layerInfo.layer.setVisible(newVisible);
			}

			layerVisibility.set(layerId, {
				...layerInfo,
				visible: newVisible
			});

			layerVisibility = new Map(layerVisibility);

			$layerVisibilityConfig = {
				...$layerVisibilityConfig,
				[layerId]: newVisible
			};

			onLayerVisibilityChanged({
				layerId,
				visible: newVisible,
				layer: layerInfo.layer
			});
		}
	}

	/**
	 * Toggle the visibility of a node type
	 * @param {string} nodeTypeName - The name of the node type to toggle
	 */
	function toggleNodeTypeVisibility(nodeTypeName) {
		const currentStyles = $nodeTypeStyles;
		const currentConfig = currentStyles[nodeTypeName] || {
			color: DEFAULT_NODE_COLOR,
			size: DEFAULT_NODE_SIZE,
			visible: true
		};

		$nodeTypeStyles = {
			...currentStyles,
			[nodeTypeName]: {
				...currentConfig,
				visible: !currentConfig.visible
			}
		};

		onNodeTypeVisibilityChanged({
			nodeType: nodeTypeName,
			visible: !currentConfig.visible
		});
	}

	/**
	 * Toggle the expansion state of the node subtypes
	 */
	function toggleNodeSubtypes() {
		isNodeSubtypesExpanded = !isNodeSubtypesExpanded;
	}

	/**
	 * Check if a node type is visible
	 * @param {string} nodeTypeName - The name of the node type to check
	 * @returns {boolean} True if the node type is visible
	 */
	function isNodeTypeVisible(nodeTypeName) {
		const config = $nodeTypeStyles[nodeTypeName];
		return config ? config.visible : true;
	}

	/**
	 * Get the color of a node type
	 * @param {string} nodeTypeName - The name of the node type to get the color of
	 * @returns {string} The color of the node type
	 */
	function getNodeTypeColor(nodeTypeName) {
		const config = $nodeTypeStyles[nodeTypeName];
		return config?.color || DEFAULT_NODE_COLOR;
	}

	/**
	 * Toggle the expansion state of the trench subtypes
	 */
	function toggleTrenchSubtypes() {
		isTrenchSubtypesExpanded = !isTrenchSubtypesExpanded;
	}

	/**
	 * Get the name key for a trench type based on current style mode
	 * @param {{ surface?: string, construction_type?: string }} trenchType - The trench type object
	 * @returns {string} The name of the trench type
	 */
	function getTrenchTypeName(trenchType) {
		return (
			($trenchStyleMode === 'surface' ? trenchType.surface : trenchType.construction_type) ?? ''
		);
	}

	/**
	 * Check if a trench type is visible
	 * @param {string} typeName - The name of the trench type to check
	 * @returns {boolean} True if the trench type is visible
	 */
	function isTrenchTypeVisible(typeName) {
		const styles =
			$trenchStyleMode === 'surface' ? $trenchSurfaceStyles : $trenchConstructionTypeStyles;
		const config = styles[typeName];
		return config ? config.visible : true;
	}

	/**
	 * Get the color of a trench type
	 * @param {string} typeName - The name of the trench type to get the color of
	 * @returns {string} The color of the trench type
	 */
	function getTrenchTypeColor(typeName) {
		const styles =
			$trenchStyleMode === 'surface' ? $trenchSurfaceStyles : $trenchConstructionTypeStyles;
		const config = styles[typeName];
		return config?.color || DEFAULT_TRENCH_COLOR;
	}

	/**
	 * Toggle the visibility of a trench type
	 * @param {string} typeName - The name of the trench type to toggle
	 */
	function toggleTrenchTypeVisibility(typeName) {
		if ($trenchStyleMode === 'surface') {
			const currentStyles = $trenchSurfaceStyles;
			const currentConfig = currentStyles[typeName] || {
				color: DEFAULT_TRENCH_COLOR,
				visible: true
			};

			$trenchSurfaceStyles = {
				...currentStyles,
				[typeName]: {
					...currentConfig,
					visible: !currentConfig.visible
				}
			};
		} else if ($trenchStyleMode === 'construction_type') {
			const currentStyles = $trenchConstructionTypeStyles;
			const currentConfig = currentStyles[typeName] || {
				color: DEFAULT_TRENCH_COLOR,
				visible: true
			};

			$trenchConstructionTypeStyles = {
				...currentStyles,
				[typeName]: {
					...currentConfig,
					visible: !currentConfig.visible
				}
			};
		}

		onTrenchTypeVisibilityChanged({
			trenchType: typeName,
			visible: !isTrenchTypeVisible(typeName),
			styleMode: $trenchStyleMode
		});
	}

	/**
	 * Toggle the expansion state of the area subtypes
	 */
	function toggleAreaSubtypes() {
		isAreaSubtypesExpanded = !isAreaSubtypesExpanded;
	}

	/**
	 * Check if an area type is visible
	 * @param {string} areaTypeName - The name of the area type to check
	 * @returns {boolean} True if the area type is visible
	 */
	function isAreaTypeVisible(areaTypeName) {
		const config = $areaTypeStyles[areaTypeName];
		return config ? config.visible : true;
	}

	/**
	 * Get the color of an area type
	 * @param {string} areaTypeName - The name of the area type to get the color of
	 * @returns {string} The color of the area type
	 */
	function getAreaTypeColor(areaTypeName) {
		const config = $areaTypeStyles[areaTypeName];
		return config?.color || DEFAULT_AREA_COLOR;
	}

	/**
	 * Toggle the visibility of an area type
	 * @param {string} areaTypeName - The name of the area type to toggle
	 */
	function toggleAreaTypeVisibility(areaTypeName) {
		const currentStyles = $areaTypeStyles;
		const currentConfig = currentStyles[areaTypeName] || {
			color: DEFAULT_AREA_COLOR,
			visible: true
		};

		$areaTypeStyles = {
			...currentStyles,
			[areaTypeName]: {
				...currentConfig,
				visible: !currentConfig.visible
			}
		};

		onAreaTypeVisibilityChanged({
			areaType: areaTypeName,
			visible: !currentConfig.visible
		});
	}

	/**
	 * Map layer ID to label config key
	 * @param {string} layerId - The layer ID
	 * @returns {'trench' | 'address' | 'node' | 'area' | 'conduit' | null} The label config key or null if not supported
	 */
	function getLabelConfigKey(layerId) {
		/** @type {Record<string, 'trench' | 'address' | 'node' | 'area' | 'conduit'>} */
		const mapping = {
			'trench-layer': 'trench',
			'address-layer': 'address',
			'node-layer': 'node',
			'area-layer': 'area'
		};
		return mapping[layerId] || null;
	}

	/**
	 * Map layer ID to API layer type for extent endpoint
	 * @param {string} layerId - The layer ID
	 * @returns {string|null} The API layer type or null if not supported
	 */
	function getExtentLayerType(layerId) {
		/** @type {Record<string, string>} */
		const mapping = {
			'trench-layer': 'trench',
			'address-layer': 'address',
			'node-layer': 'node',
			'area-layer': 'area'
		};
		return mapping[layerId] || null;
	}

	/**
	 * Check if labels are enabled for a layer
	 * @param {string} layerId - The layer ID
	 * @returns {boolean} True if labels are enabled
	 */
	function isLabelEnabled(layerId) {
		const key = getLabelConfigKey(layerId);
		return key ? $labelVisibilityConfig[key] : false;
	}

	/**
	 * Toggle label visibility for a layer
	 * @param {string} layerId - The layer ID
	 */
	function toggleLabelVisibility(layerId) {
		const key = getLabelConfigKey(layerId);
		if (!key) return;

		const newEnabled = !$labelVisibilityConfig[key];
		$labelVisibilityConfig = {
			...$labelVisibilityConfig,
			[key]: newEnabled
		};

		onLabelVisibilityChanged({
			layerId,
			labelType: key,
			enabled: newEnabled
		});
	}

	/**
	 * Check if conduit labels are enabled
	 * @returns {boolean} True if conduit labels are enabled
	 */
	function isConduitLabelEnabled() {
		return $labelVisibilityConfig.conduit || false;
	}

	/**
	 * Toggle conduit label visibility
	 */
	function toggleConduitLabelVisibility() {
		const newEnabled = !$labelVisibilityConfig.conduit;
		$labelVisibilityConfig = {
			...$labelVisibilityConfig,
			conduit: newEnabled
		};

		onLabelVisibilityChanged({
			layerId: 'trench-layer', // Uses trench layer
			labelType: 'conduit',
			enabled: newEnabled
		});
	}

	/**
	 * Toggle the expansion state of a WMS source
	 * @param {string} sourceId - The ID of the WMS source
	 */
	function toggleWMSSourceExpansion(sourceId) {
		const current = getWMSSourceExpanded($wmsSourceExpansionState, projectId, sourceId);
		$wmsSourceExpansionState = setWMSSourceExpanded(
			$wmsSourceExpansionState,
			projectId,
			sourceId,
			!current
		);
	}

	/**
	 * Check if a WMS source is expanded
	 * @param {string} sourceId - The ID of the WMS source
	 * @returns {boolean} True if the source is expanded
	 */
	function isWMSSourceExpanded(sourceId) {
		return getWMSSourceExpanded($wmsSourceExpansionState, projectId, sourceId);
	}

	/**
	 * Check if a WMS layer is visible
	 * @param {string} layerId - The layer ID
	 * @returns {boolean} True if the layer is visible
	 */
	function isWMSLayerVisible(layerId) {
		return getWMSLayerVisibility($wmsLayerVisibilityConfig, projectId, layerId, true);
	}

	/**
	 * Toggle the visibility of a WMS layer
	 * @param {string} layerId - The layer ID
	 */
	function toggleWMSLayerVisibility(layerId) {
		const current = isWMSLayerVisible(layerId);
		$wmsLayerVisibilityConfig = setWMSLayerVisibility(
			$wmsLayerVisibilityConfig,
			projectId,
			layerId,
			!current
		);
		onWMSLayerVisibilityChanged(layerId, !current);
	}

	/**
	 * Toggle the mobile bottom sheet open/closed
	 */
	function toggleMobileSheet() {
		isMobileSheetOpen = !isMobileSheetOpen;
		if (!isMobileSheetOpen) {
			currentTranslate = 0;
		}
	}

	/**
	 * Close the mobile bottom sheet
	 */
	function closeMobileSheet() {
		isMobileSheetOpen = false;
		currentTranslate = 0;
	}

	/**
	 * Toggle the layer tree expanded state (desktop only)
	 */
	function toggleLayerTreeExpanded() {
		$layerTreeExpanded = !$layerTreeExpanded;
	}

	/**
	 * Handle touch start for drag gesture
	 * @param {TouchEvent} e - Touch event
	 */
	function handleTouchStart(e) {
		isDragging = true;
		startY = e.touches[0].clientY;
	}

	/**
	 * Handle touch move for drag gesture
	 * @param {TouchEvent} e - Touch event
	 */
	function handleTouchMove(e) {
		if (!isDragging) return;
		const currentY = e.touches[0].clientY;
		const diff = currentY - startY;
		if (diff > 0) {
			currentTranslate = diff;
			e.preventDefault();
		}
	}

	/**
	 * Action to attach a non-passive touchmove listener
	 * @param {HTMLElement} node
	 */
	function nonPassiveTouchMove(node) {
		node.addEventListener('touchmove', handleTouchMove, { passive: false });
		return {
			destroy() {
				node.removeEventListener('touchmove', handleTouchMove);
			}
		};
	}

	/**
	 * Handle touch end for drag gesture
	 */
	function handleTouchEnd() {
		isDragging = false;
		if (currentTranslate > 100) {
			closeMobileSheet();
		} else {
			currentTranslate = 0;
		}
	}
</script>

<!-- LayerVisibilityTree: Mobile bottom sheet variant -->
<div class="sm:hidden">
	<button
		onclick={toggleMobileSheet}
		class="fixed bottom-20 right-4 z-20 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
		aria-label={m.form_layer()}
	>
		<IconStack2 size={24} />
	</button>

	<!-- Mobile Bottom Sheet -->
	{#if isMobileSheetOpen}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 bg-black/40 z-30 animate-in fade-in duration-200"
			onclick={closeMobileSheet}
			aria-label={m.tooltip_close_layers()}
			{@attach tooltip(m.tooltip_close_layers())}
		></button>

		<!-- Sheet -->
		<div
			class="fixed bottom-0 left-0 right-0 z-40 bg-surface-50-950 rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
			style="height: 75vh; max-height: calc(75vh - env(safe-area-inset-bottom)); transform: translateY({currentTranslate}px); transition: {isDragging
				? 'none'
				: 'transform 0.2s ease-out'};"
		>
			<!-- Drag Handle -->
			<div
				class="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
				ontouchstart={handleTouchStart}
				use:nonPassiveTouchMove
				ontouchend={handleTouchEnd}
				role="slider"
				aria-valuenow={currentTranslate}
				aria-label={m.tooltip_drag_to_close()}
				tabindex="0"
			>
				<div class="w-12 h-1.5 bg-surface-300-600 rounded-full"></div>
			</div>

			<!-- Header -->
			<div class="flex items-center justify-between px-4 pb-3 border-b border-surface-200-800">
				<h2 class="text-lg font-semibold text-surface-contrast-100-900">{m.form_layer()}</h2>
				<button
					onclick={closeMobileSheet}
					class="p-2 rounded-full hover:bg-surface-200-800 transition-colors"
					aria-label={m.tooltip_close()}
					{@attach tooltip(m.tooltip_close())}
				>
					<IconX size={20} class="text-surface-500" />
				</button>
			</div>

			<!-- Opacity Slider (mobile only) -->
			{#if mobileOpacitySlider}
				<div class="px-4 py-2 border-b border-surface-200-800">
					<OpacitySlider
						minOpacity={mobileOpacitySlider.minOpacity}
						maxOpacity={mobileOpacitySlider.maxOpacity}
						stepOpacity={mobileOpacitySlider.stepOpacity}
						opacity={mobileOpacitySlider.opacity}
						onChange={mobileOpacitySlider.onChange}
						compact
					/>
				</div>
			{/if}

			<!-- Layer List -->
			<div class="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-20 space-y-2">
				{#each Array.from(layerVisibility.entries()) as [layerId, layerInfo]}
					<div class="bg-surface-100-900 rounded-xl overflow-hidden">
						<!-- Layer Row -->
						<div class="flex items-center justify-between p-3">
							<div class="flex items-center gap-3 flex-1 min-w-0">
								<!-- Expand/collapse button -->
								{#if layerId === 'node-layer' && nodeTypes.length > 0}
									<button
										class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-200-800 transition-colors shrink-0"
										onclick={toggleNodeSubtypes}
										aria-label={isNodeSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()}
										{@attach tooltip(
											isNodeSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()
										)}
									>
										{#if isNodeSubtypesExpanded}
											<IconChevronDown size="18" class="text-surface-900-100" />
										{:else}
											<IconChevronRight size="18" class="text-surface-900-100" />
										{/if}
									</button>
								{:else if layerId === 'trench-layer' && trenchTypes.length > 0}
									<button
										class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-200-800 transition-colors shrink-0"
										onclick={toggleTrenchSubtypes}
										aria-label={isTrenchSubtypesExpanded
											? m.tooltip_collapse()
											: m.tooltip_expand()}
										{@attach tooltip(
											isTrenchSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()
										)}
									>
										{#if isTrenchSubtypesExpanded}
											<IconChevronDown size="18" class="text-surface-900-100" />
										{:else}
											<IconChevronRight size="18" class="text-surface-900-100" />
										{/if}
									</button>
								{:else if layerId === 'area-layer' && areaTypes.length > 0}
									<button
										class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-200-800 transition-colors shrink-0"
										onclick={toggleAreaSubtypes}
										aria-label={isAreaSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()}
										{@attach tooltip(
											isAreaSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()
										)}
									>
										{#if isAreaSubtypesExpanded}
											<IconChevronDown size="18" class="text-surface-900-100" />
										{:else}
											<IconChevronRight size="18" class="text-surface-900-100" />
										{/if}
									</button>
								{:else}
									<span class="w-8 h-8 shrink-0"></span>
								{/if}

								<span class="text-base font-medium text-surface-contrast-100-900 truncate">
									{layerInfo.name}
								</span>
							</div>

							<div class="flex items-center gap-1 shrink-0">
								{#if getExtentLayerType(layerId)}
									<button
										class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all"
										onclick={() =>
											onZoomToExtent({ layerId, layerType: getExtentLayerType(layerId) })}
										aria-label={m.tooltip_zoom_to_extent()}
										{@attach tooltip(m.tooltip_zoom_to_extent())}
									>
										<IconZoomScan size="22" class="text-surface-900-100" />
									</button>
								{/if}

								{#if getLabelConfigKey(layerId)}
									<button
										class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all"
										onclick={() => toggleLabelVisibility(layerId)}
										aria-label={isLabelEnabled(layerId)
											? m.tooltip_hide_labels()
											: m.tooltip_show_labels()}
										{@attach tooltip(
											isLabelEnabled(layerId) ? m.tooltip_hide_labels() : m.tooltip_show_labels()
										)}
									>
										{#if isLabelEnabled(layerId)}
											<IconLabelFilled size="22" class="text-primary-500" />
										{:else}
											<IconLabel size="22" class="text-surface-900-100" />
										{/if}
									</button>
								{/if}

								<!-- Theme toggle for OSM base layer (only when using vector tiles) -->
								{#if layerId === 'osm-base-layer' && !usingFallbackOSM}
									<button
										class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all"
										onclick={toggleBasemapTheme}
										aria-label={$basemapTheme === 'light'
											? m.tooltip_switch_to_dark_theme()
											: m.tooltip_switch_to_light_theme()}
										{@attach tooltip(
											$basemapTheme === 'light'
												? m.tooltip_switch_to_dark_theme()
												: m.tooltip_switch_to_light_theme()
										)}
									>
										{#if $basemapTheme === 'light'}
											<IconMoon size="22" class="text-surface-900-100" />
										{:else}
											<IconSun size="22" class="text-yellow-500" />
										{/if}
									</button>
								{/if}

								<button
									class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all"
									onclick={() => toggleLayerVisibility(layerId)}
									aria-label={layerInfo.visible ? m.tooltip_hide_layer() : m.tooltip_show_layer()}
									{@attach tooltip(
										layerInfo.visible ? m.tooltip_hide_layer() : m.tooltip_show_layer()
									)}
								>
									{#if layerInfo.visible}
										<IconEye size="22" class="text-primary-500" />
									{:else}
										<IconEyeOff size="22" class="text-surface-900-100" />
									{/if}
								</button>
							</div>
						</div>

						<!-- Subtypes -->
						{#if layerId === 'node-layer' && isNodeSubtypesExpanded && nodeTypes.length > 0}
							<div class="px-3 pb-3 space-y-1">
								{#each nodeTypes as nodeType}
									{@const visible = isNodeTypeVisible(nodeType.node_type)}
									{@const color = getNodeTypeColor(nodeType.node_type)}
									<div
										class="flex items-center justify-between p-2.5 rounded-lg bg-surface-50-950/50"
									>
										<div class="flex items-center gap-3 flex-1 min-w-0">
											<span
												class="w-4 h-4 rounded-full shrink-0 border-2 border-surface-300-600"
												style="background-color: {color};"
											></span>
											<span class="text-sm text-surface-contrast-100-900 truncate">
												{nodeType.node_type}
											</span>
										</div>
										<button
											class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all shrink-0"
											onclick={() => toggleNodeTypeVisibility(nodeType.node_type)}
											aria-label={visible ? m.tooltip_hide() : m.tooltip_show()}
											{@attach tooltip(visible ? m.tooltip_hide() : m.tooltip_show())}
										>
											{#if visible}
												<IconEye size="20" class="text-primary-500" />
											{:else}
												<IconEyeOff size="20" class="text-surface-900-100" />
											{/if}
										</button>
									</div>
								{/each}
							</div>
						{/if}

						{#if layerId === 'trench-layer' && isTrenchSubtypesExpanded && trenchTypes.length > 0}
							<div class="px-3 pb-3 space-y-1">
								{#each trenchTypes as trenchType (trenchType.id)}
									{@const typeName = getTrenchTypeName(trenchType)}
									{@const visible = isTrenchTypeVisible(typeName)}
									{@const color = getTrenchTypeColor(typeName)}
									<div
										class="flex items-center justify-between p-2.5 rounded-lg bg-surface-50-950/50"
									>
										<div class="flex items-center gap-3 flex-1 min-w-0">
											<span
												class="w-5 h-1.5 shrink-0 rounded-full"
												style="background-color: {color};"
											></span>
											<span class="text-sm text-surface-contrast-100-900 truncate">
												{typeName}
											</span>
										</div>
										<button
											class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all shrink-0"
											onclick={() => toggleTrenchTypeVisibility(typeName)}
											aria-label={visible ? m.tooltip_hide() : m.tooltip_show()}
											{@attach tooltip(visible ? m.tooltip_hide() : m.tooltip_show())}
										>
											{#if visible}
												<IconEye size="20" class="text-primary-500" />
											{:else}
												<IconEyeOff size="20" class="text-surface-900-100" />
											{/if}
										</button>
									</div>
								{/each}
							</div>
						{/if}

						{#if layerId === 'area-layer' && isAreaSubtypesExpanded && areaTypes.length > 0}
							<div class="px-3 pb-3 space-y-1">
								{#each areaTypes as areaType (areaType.id)}
									{@const visible = isAreaTypeVisible(areaType.area_type)}
									{@const color = getAreaTypeColor(areaType.area_type)}
									<div
										class="flex items-center justify-between p-2.5 rounded-lg bg-surface-50-950/50"
									>
										<div class="flex items-center gap-3 flex-1 min-w-0">
											<span
												class="w-4 h-4 shrink-0 rounded border-2 border-surface-300-600"
												style="background-color: {color}; opacity: 0.6;"
											></span>
											<span class="text-sm text-surface-contrast-100-900 truncate">
												{areaType.area_type}
											</span>
										</div>
										<button
											class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all shrink-0"
											onclick={() => toggleAreaTypeVisibility(areaType.area_type)}
											aria-label={visible ? m.tooltip_hide() : m.tooltip_show()}
											{@attach tooltip(visible ? m.tooltip_hide() : m.tooltip_show())}
										>
											{#if visible}
												<IconEye size="20" class="text-primary-500" />
											{:else}
												<IconEyeOff size="20" class="text-surface-900-100" />
											{/if}
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- WMS Sources - separate entries after area layer (Mobile) -->
					{#if layerId === 'area-layer' && wmsSources.length > 0}
						{#each wmsSources as source (source.id)}
							{@const enabledLayers = source.layers.filter(
								(/** @type {WMSLayer} */ l) => l.is_enabled
							)}
							{#if enabledLayers.length > 0}
								{@const isExpanded = isWMSSourceExpanded(source.id)}
								<div class="bg-surface-100-900 rounded-xl overflow-hidden">
									<!-- Source Header -->
									<div class="flex items-center justify-between p-3">
										<div class="flex items-center gap-3 flex-1 min-w-0">
											<button
												class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-200-800 transition-colors shrink-0"
												onclick={() => toggleWMSSourceExpansion(source.id)}
												aria-label={isExpanded ? m.tooltip_collapse() : m.tooltip_expand()}
												{@attach tooltip(isExpanded ? m.tooltip_collapse() : m.tooltip_expand())}
											>
												{#if isExpanded}
													<IconChevronDown size="18" class="text-surface-900-100" />
												{:else}
													<IconChevronRight size="18" class="text-surface-900-100" />
												{/if}
											</button>
											<span class="text-base font-medium text-surface-contrast-100-900 truncate">
												{source.name}
											</span>
										</div>
									</div>

									<!-- Nested Layers -->
									{#if isExpanded}
										<div class="px-3 pb-3 space-y-2 ml-11 border-l-2 border-surface-200-700">
											{#each enabledLayers as layer (layer.id)}
												{@const wmsLayerId = `wms-${source.id}-${layer.name}`}
												{@const visible = isWMSLayerVisible(wmsLayerId)}
												<div class="flex items-center justify-between py-2">
													<span
														class="text-sm text-surface-contrast-100-900 truncate flex-1 min-w-0"
													>
														{layer.title || layer.name}
													</span>
													<button
														class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all shrink-0"
														onclick={() => toggleWMSLayerVisibility(wmsLayerId)}
														aria-label={visible ? m.tooltip_hide_layer() : m.tooltip_show_layer()}
														{@attach tooltip(
															visible ? m.tooltip_hide_layer() : m.tooltip_show_layer()
														)}
													>
														{#if visible}
															<IconEye size="22" class="text-primary-500" />
														{:else}
															<IconEyeOff size="22" class="text-surface-900-100" />
														{/if}
													</button>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					{/if}

					<!-- Conduit Labels - after trench layer -->
					{#if layerId === 'trench-layer'}
						<div class="bg-surface-100-900 rounded-xl overflow-hidden">
							<div class="flex items-center justify-between p-3">
								<div class="flex items-center gap-3 flex-1 min-w-0">
									<span class="w-8 h-8 shrink-0"></span>
									<span class="text-base font-medium text-surface-contrast-100-900 truncate">
										{m.form_conduit({ count: 1 })}
									</span>
								</div>
								<div class="flex items-center gap-1 shrink-0">
									<button
										class="p-2 rounded-lg hover:bg-surface-200-700 active:scale-95 transition-all shrink-0"
										onclick={toggleConduitLabelVisibility}
										aria-label={isConduitLabelEnabled()
											? m.tooltip_hide_conduit_labels()
											: m.tooltip_show_conduit_labels()}
										{@attach tooltip(
											isConduitLabelEnabled()
												? m.tooltip_hide_conduit_labels()
												: m.tooltip_show_conduit_labels()
										)}
									>
										{#if isConduitLabelEnabled()}
											<IconLabelFilled size="22" class="text-primary-500" />
										{:else}
											<IconLabel size="22" class="text-surface-900-100" />
										{/if}
									</button>
								</div>
							</div>
						</div>
					{/if}
				{/each}

				{#if layerVisibility.size === 0 && wmsSources.length === 0}
					<p class="text-sm text-surface-400 italic text-center py-6">
						{m.form_no_layers_available()}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- LayerVisibilityTree: Desktop sidebar variant -->
<div
	class="hidden sm:flex sm:flex-col w-72 p-3 border border-surface-200-800 bg-surface-50-950 rounded-lg shadow-md"
	class:max-h-[calc(100vh-12rem)]={$layerTreeExpanded}
>
	<!-- Header -->
	<div class="flex items-center justify-between shrink-0">
		<button
			class="flex items-center gap-1.5 hover:bg-surface-100-800 rounded px-1 py-0.5 transition-colors"
			onclick={toggleLayerTreeExpanded}
			aria-label={$layerTreeExpanded
				? m.tooltip_collapse_layer_tree()
				: m.tooltip_expand_layer_tree()}
			{@attach tooltip(
				$layerTreeExpanded ? m.tooltip_collapse_layer_tree() : m.tooltip_expand_layer_tree()
			)}
		>
			{#if $layerTreeExpanded}
				<IconChevronDown size="16" class="text-surface-900-100" />
			{:else}
				<IconChevronRight size="16" class="text-surface-900-100" />
			{/if}
			<p class="text-sm font-semibold text-surface-contrast-100-900">{m.form_layer()}</p>
		</button>
	</div>

	<!-- Layer list -->
	{#if $layerTreeExpanded}
		<div
			class="space-y-1.5 overflow-y-auto flex-1 min-h-0 mt-3 pt-2 border-t border-surface-200-800"
		>
			{#each Array.from(layerVisibility.entries()) as [layerId, layerInfo]}
				<div>
					<div
						class="flex items-center gap-1.5 py-1 rounded hover:bg-surface-100-800 transition-colors"
					>
						<!-- Expand/Collapse button -->
						{#if layerId === 'node-layer' && nodeTypes.length > 0}
							<button
								class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-200-700 transition-colors shrink-0"
								onclick={toggleNodeSubtypes}
								aria-label={isNodeSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()}
								{@attach tooltip(
									isNodeSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()
								)}
							>
								{#if isNodeSubtypesExpanded}
									<IconChevronDown size="14" class="text-surface-900-100" />
								{:else}
									<IconChevronRight size="14" class="text-surface-900-100" />
								{/if}
							</button>
						{:else if layerId === 'trench-layer' && trenchTypes.length > 0}
							<button
								class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-200-700 transition-colors shrink-0"
								onclick={toggleTrenchSubtypes}
								aria-label={isTrenchSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()}
								{@attach tooltip(
									isTrenchSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()
								)}
							>
								{#if isTrenchSubtypesExpanded}
									<IconChevronDown size="14" class="text-surface-900-100" />
								{:else}
									<IconChevronRight size="14" class="text-surface-900-100" />
								{/if}
							</button>
						{:else if layerId === 'area-layer' && areaTypes.length > 0}
							<button
								class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-200-700 transition-colors shrink-0"
								onclick={toggleAreaSubtypes}
								aria-label={isAreaSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()}
								{@attach tooltip(
									isAreaSubtypesExpanded ? m.tooltip_collapse() : m.tooltip_expand()
								)}
							>
								{#if isAreaSubtypesExpanded}
									<IconChevronDown size="14" class="text-surface-900-100" />
								{:else}
									<IconChevronRight size="14" class="text-surface-900-100" />
								{/if}
							</button>
						{:else}
							<span class="w-5 h-5 shrink-0"></span>
						{/if}

						<!-- Layer name -->
						<span class="text-xs text-surface-contrast-100-900 truncate flex-1 min-w-0">
							{layerInfo.name}
						</span>

						<!-- Zoom button -->
						{#if getExtentLayerType(layerId)}
							<button
								class="w-6 flex items-center justify-center shrink-0 rounded hover:bg-surface-200-700 transition-colors"
								onclick={() => onZoomToExtent({ layerId, layerType: getExtentLayerType(layerId) })}
								aria-label={m.tooltip_zoom_to_extent()}
								{@attach tooltip(m.tooltip_zoom_to_extent())}
							>
								<IconZoomScan size={24} class="text-surface-900-100" />
							</button>
						{:else}
							<span class="w-6 shrink-0"></span>
						{/if}

						<!-- Label button -->
						{#if getLabelConfigKey(layerId)}
							<button
								class="w-6 flex items-center justify-center shrink-0 rounded hover:bg-surface-200-700 transition-colors"
								onclick={() => toggleLabelVisibility(layerId)}
								aria-label={isLabelEnabled(layerId)
									? m.tooltip_hide_labels()
									: m.tooltip_show_labels()}
								{@attach tooltip(
									isLabelEnabled(layerId) ? m.tooltip_hide_labels() : m.tooltip_show_labels()
								)}
							>
								{#if isLabelEnabled(layerId)}
									<IconLabelFilled size={24} class="text-primary-500" />
								{:else}
									<IconLabel size={24} class="text-surface-900-100" />
								{/if}
							</button>
						{:else}
							<span class="w-6 shrink-0"></span>
						{/if}

						<!-- Theme toggle for OSM base layer (only when using vector tiles) -->
						{#if layerId === 'osm-base-layer' && !usingFallbackOSM}
							<button
								class="w-6 flex items-center justify-center shrink-0 rounded hover:bg-surface-200-700 transition-colors"
								onclick={toggleBasemapTheme}
								aria-label={$basemapTheme === 'light'
									? m.tooltip_switch_to_dark_theme()
									: m.tooltip_switch_to_light_theme()}
								{@attach tooltip(
									$basemapTheme === 'light'
										? m.tooltip_switch_to_dark_theme()
										: m.tooltip_switch_to_light_theme()
								)}
							>
								{#if $basemapTheme === 'light'}
									<IconMoon size={24} class="text-surface-900-100" />
								{:else}
									<IconSun size={24} class="text-yellow-500" />
								{/if}
							</button>
						{/if}

						<!-- Visibility button -->
						<button
							class="w-6 flex items-center justify-center shrink-0 rounded hover:bg-surface-200-700 transition-colors"
							onclick={() => toggleLayerVisibility(layerId)}
							aria-label={layerInfo.visible ? m.tooltip_hide_layer() : m.tooltip_show_layer()}
							{@attach tooltip(layerInfo.visible ? m.tooltip_hide_layer() : m.tooltip_show_layer())}
						>
							{#if layerInfo.visible}
								<IconEye size={24} class="text-primary-500" />
							{:else}
								<IconEyeOff size={24} class="text-surface-900-100" />
							{/if}
						</button>
					</div>

					<!-- Node type subtypes -->
					{#if layerId === 'node-layer' && isNodeSubtypesExpanded && nodeTypes.length > 0}
						<div class="ml-6 mt-1 space-y-1 border-l-2 border-surface-200-700 pl-2">
							{#each nodeTypes as nodeType}
								{@const visible = isNodeTypeVisible(nodeType.node_type)}
								{@const color = getNodeTypeColor(nodeType.node_type)}
								<div
									class="flex items-center justify-between py-1 px-1 rounded hover:bg-surface-100-800 transition-colors"
								>
									<div class="flex items-center gap-2 flex-1 min-w-0">
										<span
											class="w-3 h-3 rounded-full shrink-0 border border-surface-300-600"
											style="background-color: {color};"
										></span>
										<span
											class="text-xs text-surface-contrast-100-900 truncate"
											{@attach tooltip(nodeType.node_type)}
										>
											{nodeType.node_type}
										</span>
									</div>
									<button
										class="p-1 rounded hover:bg-surface-200-700 transition-colors shrink-0"
										onclick={() => toggleNodeTypeVisibility(nodeType.node_type)}
										aria-label={visible ? m.tooltip_hide() : m.tooltip_show()}
										{@attach tooltip(visible ? m.tooltip_hide() : m.tooltip_show())}
									>
										{#if visible}
											<IconEye size={24} class="text-primary-500" />
										{:else}
											<IconEyeOff size={24} class="text-surface-900-100" />
										{/if}
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Trench type subtypes -->
					{#if layerId === 'trench-layer' && isTrenchSubtypesExpanded && trenchTypes.length > 0}
						<div class="ml-6 mt-1 space-y-1 border-l-2 border-surface-200-700 pl-2">
							{#each trenchTypes as trenchType (trenchType.id)}
								{@const typeName = getTrenchTypeName(trenchType)}
								{@const visible = isTrenchTypeVisible(typeName)}
								{@const color = getTrenchTypeColor(typeName)}
								<div
									class="flex items-center justify-between py-1 px-1 rounded hover:bg-surface-100-800 transition-colors"
								>
									<div class="flex items-center gap-2 flex-1 min-w-0">
										<span class="w-4 h-1 shrink-0 rounded-sm" style="background-color: {color};"
										></span>
										<span
											class="text-xs text-surface-contrast-100-900 truncate"
											{@attach tooltip(typeName)}
										>
											{typeName}
										</span>
									</div>
									<button
										class="p-1 rounded hover:bg-surface-200-700 transition-colors shrink-0"
										onclick={() => toggleTrenchTypeVisibility(typeName)}
										aria-label={visible ? m.tooltip_hide() : m.tooltip_show()}
										{@attach tooltip(visible ? m.tooltip_hide() : m.tooltip_show())}
									>
										{#if visible}
											<IconEye size={24} class="text-primary-500" />
										{:else}
											<IconEyeOff size={24} class="text-surface-900-100" />
										{/if}
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Area type subtypes -->
					{#if layerId === 'area-layer' && isAreaSubtypesExpanded && areaTypes.length > 0}
						<div class="ml-6 mt-1 space-y-1 border-l-2 border-surface-200-700 pl-2">
							{#each areaTypes as areaType (areaType.id)}
								{@const visible = isAreaTypeVisible(areaType.area_type)}
								{@const color = getAreaTypeColor(areaType.area_type)}
								<div
									class="flex items-center justify-between py-1 px-1 rounded hover:bg-surface-100-800 transition-colors"
								>
									<div class="flex items-center gap-2 flex-1 min-w-0">
										<span
											class="w-3 h-3 shrink-0 rounded-sm border border-surface-300-600"
											style="background-color: {color}; opacity: 0.6;"
										></span>
										<span
											class="text-xs text-surface-contrast-100-900 truncate"
											{@attach tooltip(areaType.area_type)}
										>
											{areaType.area_type}
										</span>
									</div>
									<button
										class="p-1 rounded hover:bg-surface-200-700 transition-colors shrink-0"
										onclick={() => toggleAreaTypeVisibility(areaType.area_type)}
										aria-label={visible ? m.tooltip_hide() : m.tooltip_show()}
										{@attach tooltip(visible ? m.tooltip_hide() : m.tooltip_show())}
									>
										{#if visible}
											<IconEye size={24} class="text-primary-500" />
										{:else}
											<IconEyeOff size={24} class="text-surface-900-100" />
										{/if}
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- WMS Sources - separate entries after area layer -->
				{#if layerId === 'area-layer' && wmsSources.length > 0}
					{#each wmsSources as source (source.id)}
						{@const enabledLayers = source.layers.filter(
							(/** @type {WMSLayer} */ l) => l.is_enabled
						)}
						{#if enabledLayers.length > 0}
							{@const isExpanded = isWMSSourceExpanded(source.id)}
							<div>
								<!-- Source Header -->
								<div
									class="flex items-center gap-1.5 py-1 rounded hover:bg-surface-100-800 transition-colors"
								>
									<button
										class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-200-700 transition-colors shrink-0"
										onclick={() => toggleWMSSourceExpansion(source.id)}
										aria-label={isExpanded ? m.tooltip_collapse() : m.tooltip_expand()}
										{@attach tooltip(isExpanded ? m.tooltip_collapse() : m.tooltip_expand())}
									>
										{#if isExpanded}
											<IconChevronDown size="14" class="text-surface-900-100" />
										{:else}
											<IconChevronRight size="14" class="text-surface-900-100" />
										{/if}
									</button>
									<span class="text-xs text-surface-contrast-100-900 truncate flex-1 min-w-0">
										{source.name}
									</span>
									<!-- Spacers to align with other layers -->
									<span class="w-6 shrink-0"></span>
									<span class="w-6 shrink-0"></span>
									<span class="w-6 shrink-0"></span>
								</div>

								<!-- Nested Layers -->
								{#if isExpanded}
									<div class="ml-5 mt-1 space-y-0.5 border-l-2 border-surface-200-700 pl-2">
										{#each enabledLayers as layer (layer.id)}
											{@const wmsLayerId = `wms-${source.id}-${layer.name}`}
											{@const visible = isWMSLayerVisible(wmsLayerId)}
											<div
												class="flex items-center gap-1.5 py-1 rounded hover:bg-surface-100-800 transition-colors"
											>
												<span class="text-xs text-surface-contrast-100-900 truncate flex-1 min-w-0">
													{layer.title || layer.name}
												</span>
												<button
													class="w-6 flex items-center justify-center shrink-0 rounded hover:bg-surface-200-700 transition-colors"
													onclick={() => toggleWMSLayerVisibility(wmsLayerId)}
													aria-label={visible ? m.tooltip_hide_layer() : m.tooltip_show_layer()}
													{@attach tooltip(
														visible ? m.tooltip_hide_layer() : m.tooltip_show_layer()
													)}
												>
													{#if visible}
														<IconEye size={24} class="text-primary-500" />
													{:else}
														<IconEyeOff size={24} class="text-surface-900-100" />
													{/if}
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				{/if}

				<!-- Conduit Labels - separate entry after trench layer -->
				{#if layerId === 'trench-layer'}
					<div
						class="flex items-center gap-1.5 py-1 rounded hover:bg-surface-100-800 transition-colors"
					>
						<!-- Spacer for expand button -->
						<span class="w-5 h-5 shrink-0"></span>

						<!-- Layer name -->
						<span class="text-xs text-surface-contrast-100-900 truncate flex-1 min-w-0">
							{m.form_conduit({ count: 1 })}
						</span>

						<!-- Spacer for zoom button column -->
						<span class="w-6 shrink-0"></span>

						<!-- Label button -->
						<button
							class="w-6 flex items-center justify-center shrink-0 rounded hover:bg-surface-200-700 transition-colors"
							onclick={toggleConduitLabelVisibility}
							aria-label={isConduitLabelEnabled()
								? m.tooltip_hide_conduit_labels()
								: m.tooltip_show_conduit_labels()}
							{@attach tooltip(
								isConduitLabelEnabled()
									? m.tooltip_hide_conduit_labels()
									: m.tooltip_show_conduit_labels()
							)}
						>
							{#if isConduitLabelEnabled()}
								<IconLabelFilled size="24" class="text-primary-500" />
							{:else}
								<IconLabel size="24" class="text-surface-900-100" />
							{/if}
						</button>

						<!-- Spacer for visibility button column -->
						<span class="w-6 shrink-0"></span>
					</div>
				{/if}
			{/each}

			{#if layerVisibility.size === 0 && wmsSources.length === 0}
				<p class="text-xs text-surface-400 italic text-center py-3">
					{m.form_no_layers_available()}
				</p>
			{/if}
		</div>
	{/if}
</div>
