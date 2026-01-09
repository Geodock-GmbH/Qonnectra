<script>
	import {
		IconChevronDown,
		IconChevronRight,
		IconChevronUp,
		IconEye,
		IconEyeOff,
		IconLabel,
		IconLabelFilled,
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
		labelVisibilityConfig,
		layerVisibilityConfig,
		nodeTypeStyles,
		trenchConstructionTypeStyles,
		trenchStyleMode,
		trenchSurfaceStyles
	} from '$lib/stores/store';

	let {
		layers = [],
		osmLayer = null,
		nodeTypes = [],
		surfaces = [],
		constructionTypes = [],
		areaTypes = [],
		onLayerVisibilityChanged = () => {},
		onNodeTypeVisibilityChanged = () => {},
		onTrenchTypeVisibilityChanged = () => {},
		onAreaTypeVisibilityChanged = () => {},
		onLabelVisibilityChanged = () => {},
		onZoomToExtent = () => {}
	} = $props();

	let layerVisibility = $state(new Map());
	let isCollapsed = $state(false);
	let isNodeSubtypesExpanded = $state(false);
	let isTrenchSubtypesExpanded = $state(false);
	let isAreaSubtypesExpanded = $state(false);

	// Derive which trench types to show based on mode
	let trenchTypes = $derived(
		$trenchStyleMode === 'surface'
			? surfaces
			: $trenchStyleMode === 'construction_type'
				? constructionTypes
				: []
	);

	// Initialize node type styles for any new types when node types change
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

	// Define layer display order priority (lower number = higher priority)
	const LAYER_ORDER = {
		'address-layer': 1,
		'node-layer': 2,
		'trench-layer': 3,
		'area-layer': 4
	};

	// Initialize area type styles for any new types when area types change
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

	// Update layer visibility when layers change
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

		if (osmLayer) {
			const osmVisible = $layerVisibilityConfig['osm-base-layer'] ?? true;
			osmLayer.setVisible(osmVisible);

			newVisibility.set('osm-base-layer', {
				layer: osmLayer,
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

			layerInfo.layer.setVisible(newVisible);

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
	 * Toggle the collapse state of the layer visibility tree
	 */
	function toggleCollapse() {
		isCollapsed = !isCollapsed;
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
	 * @param {Object} trenchType - The trench type object
	 * @returns {string} The name of the trench type
	 */
	function getTrenchTypeName(trenchType) {
		return $trenchStyleMode === 'surface' ? trenchType.surface : trenchType.construction_type;
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
	 * @returns {string|null} The label config key or null if not supported
	 */
	function getLabelConfigKey(layerId) {
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
</script>

<!-- LayerVisibilityTree -->
<div
	class="w-full max-w-sm md:w-64 p-3 md:p-2 border-1 border-surface-200-800 bg-surface-50-950 rounded-md shadow-lg md:shadow"
>
	<!-- Header with collapse functionality for mobile -->
	<div class="flex items-center justify-between md:mb-2">
		<p class="text-sm font-medium text-surface-contrast-100-900">{m.form_layer()}</p>

		<!-- Mobile collapse button -->
		<button
			class="md:hidden p-1 rounded hover:bg-surface-100-800 transition-colors"
			onclick={toggleCollapse}
			aria-label={isCollapsed ? 'Expand layers' : 'Collapse layers'}
		>
			{#if isCollapsed}
				<IconChevronDown size="20" class="text-surface-600" />
			{:else}
				<IconChevronUp size="20" class="text-surface-600" />
			{/if}
		</button>
	</div>

	<!-- Layer list - hidden on mobile when collapsed -->
	<div class="space-y-3 md:space-y-2 {isCollapsed ? 'hidden md:block' : ''}">
		{#each Array.from(layerVisibility.entries()) as [layerId, layerInfo]}
			<div>
				<div
					class="flex items-center justify-between p-2 md:p-0 rounded-md hover:bg-surface-100-800 transition-colors"
				>
					<div class="flex items-center gap-3 md:gap-2 flex-1 min-w-0">
						<!-- Expand/collapse button for node layer -->
						{#if layerId === 'node-layer' && nodeTypes.length > 0}
							<button
								class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-200-700 transition-colors flex-shrink-0"
								onclick={toggleNodeSubtypes}
								aria-label={isNodeSubtypesExpanded ? 'Collapse node types' : 'Expand node types'}
							>
								{#if isNodeSubtypesExpanded}
									<IconChevronDown size="14" class="text-surface-500" />
								{:else}
									<IconChevronRight size="14" class="text-surface-500" />
								{/if}
							</button>
						{:else if layerId === 'trench-layer' && trenchTypes.length > 0}
							<button
								class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-200-700 transition-colors flex-shrink-0"
								onclick={toggleTrenchSubtypes}
								aria-label={isTrenchSubtypesExpanded
									? 'Collapse trench types'
									: 'Expand trench types'}
							>
								{#if isTrenchSubtypesExpanded}
									<IconChevronDown size="14" class="text-surface-500" />
								{:else}
									<IconChevronRight size="14" class="text-surface-500" />
								{/if}
							</button>
						{:else if layerId === 'area-layer' && areaTypes.length > 0}
							<button
								class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-200-700 transition-colors flex-shrink-0"
								onclick={toggleAreaSubtypes}
								aria-label={isAreaSubtypesExpanded ? 'Collapse area types' : 'Expand area types'}
							>
								{#if isAreaSubtypesExpanded}
									<IconChevronDown size="14" class="text-surface-500" />
								{:else}
									<IconChevronRight size="14" class="text-surface-500" />
								{/if}
							</button>
						{:else}
							<span class="w-5 h-5 flex-shrink-0"></span>
						{/if}

						<span class="text-sm md:text-xs px-2 md:px-0 text-surface-contrast-100-900 truncate">
							{layerInfo.name}
						</span>
					</div>

					<div class="flex items-center gap-1 flex-shrink-0">
						<!-- Zoom to extent button - only for trench, address, node layers -->
						{#if getExtentLayerType(layerId)}
							<button
								class="p-1 rounded hover:bg-surface-200-700 transition-colors"
								onclick={() => onZoomToExtent({ layerId, layerType: getExtentLayerType(layerId) })}
								aria-label="Zoom to layer extent"
								title="Zoom to layer extent"
							>
								<IconZoomScan size="24" class="text-surface-500 hover:text-primary-500" />
							</button>
						{/if}

						<!-- Label toggle button - only for trench, address, node layers -->
						{#if getLabelConfigKey(layerId)}
							<button
								class="p-1 rounded hover:bg-surface-200-700 transition-colors"
								onclick={() => toggleLabelVisibility(layerId)}
								aria-label={isLabelEnabled(layerId) ? 'Hide labels' : 'Show labels'}
								title={isLabelEnabled(layerId) ? 'Hide labels' : 'Show labels'}
							>
								{#if isLabelEnabled(layerId)}
									<IconLabelFilled size="24" class="text-primary-500" />
								{:else}
									<IconLabel size="24" class="text-surface-400" />
								{/if}
							</button>
						{/if}

						<!-- Visibility toggle button -->
						<button
							class="p-1 rounded hover:bg-surface-200-700 transition-colors"
							onclick={() => toggleLayerVisibility(layerId)}
							aria-label={layerInfo.visible ? 'Hide layer' : 'Show layer'}
							title={layerInfo.visible ? 'Hide layer' : 'Show layer'}
						>
							{#if layerInfo.visible}
								<IconEye size="24" class="text-primary-500" />
							{:else}
								<IconEyeOff size="24" class="text-surface-400" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Node type subtypes (expandable) -->
				{#if layerId === 'node-layer' && isNodeSubtypesExpanded && nodeTypes.length > 0}
					<div class="ml-6 mt-1 space-y-1 border-l border-surface-200-700 pl-2">
						{#each nodeTypes as nodeType}
							{@const visible = isNodeTypeVisible(nodeType.node_type)}
							{@const color = getNodeTypeColor(nodeType.node_type)}
							<div
								class="flex items-center justify-between p-1.5 md:p-1 rounded-md hover:bg-surface-100-800 transition-colors"
							>
								<div class="flex items-center gap-2 flex-1 min-w-0">
									<!-- Color indicator circle -->
									<span
										class="w-3 h-3 rounded-full flex-shrink-0 border border-surface-300-600"
										style="background-color: {color};"
									></span>

									<span
										class="text-xs text-surface-contrast-100-900 truncate"
										title={nodeType.node_type}
									>
										{nodeType.node_type}
									</span>
								</div>

								<button
									class="p-1 rounded hover:bg-surface-200-700 transition-colors flex-shrink-0"
									onclick={() => toggleNodeTypeVisibility(nodeType.node_type)}
									aria-label={visible ? 'Hide node type' : 'Show node type'}
									title={visible ? 'Hide node type' : 'Show node type'}
								>
									{#if visible}
										<IconEye size="24" class="text-primary-500" />
									{:else}
										<IconEyeOff size="24" class="text-surface-400" />
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Trench type subtypes (expandable) -->
				{#if layerId === 'trench-layer' && isTrenchSubtypesExpanded && trenchTypes.length > 0}
					<div class="ml-6 mt-1 space-y-1 border-l border-surface-200-700 pl-2">
						{#each trenchTypes as trenchType (trenchType.id)}
							{@const typeName = getTrenchTypeName(trenchType)}
							{@const visible = isTrenchTypeVisible(typeName)}
							{@const color = getTrenchTypeColor(typeName)}
							<div
								class="flex items-center justify-between p-1.5 md:p-1 rounded-md hover:bg-surface-100-800 transition-colors"
							>
								<div class="flex items-center gap-2 flex-1 min-w-0">
									<!-- Color indicator line (for trenches) -->
									<span class="w-4 h-1 flex-shrink-0 rounded-sm" style="background-color: {color};"
									></span>

									<span class="text-xs text-surface-contrast-100-900 truncate" title={typeName}>
										{typeName}
									</span>
								</div>

								<button
									class="p-1 rounded hover:bg-surface-200-700 transition-colors flex-shrink-0"
									onclick={() => toggleTrenchTypeVisibility(typeName)}
									aria-label={visible ? 'Hide trench type' : 'Show trench type'}
									title={visible ? 'Hide trench type' : 'Show trench type'}
								>
									{#if visible}
										<IconEye size="24" class="text-primary-500" />
									{:else}
										<IconEyeOff size="24" class="text-surface-400" />
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Area type subtypes (expandable) -->
				{#if layerId === 'area-layer' && isAreaSubtypesExpanded && areaTypes.length > 0}
					<div class="ml-6 mt-1 space-y-1 border-l border-surface-200-700 pl-2">
						{#each areaTypes as areaType (areaType.id)}
							{@const visible = isAreaTypeVisible(areaType.area_type)}
							{@const color = getAreaTypeColor(areaType.area_type)}
							<div
								class="flex items-center justify-between p-1.5 md:p-1 rounded-md hover:bg-surface-100-800 transition-colors"
							>
								<div class="flex items-center gap-2 flex-1 min-w-0">
									<!-- Color indicator square (for areas/polygons) -->
									<span
										class="w-3 h-3 flex-shrink-0 rounded-sm border border-surface-300-600"
										style="background-color: {color}; opacity: 0.5;"
									></span>

									<span
										class="text-xs text-surface-contrast-100-900 truncate"
										title={areaType.area_type}
									>
										{areaType.area_type}
									</span>
								</div>

								<button
									class="p-1 rounded hover:bg-surface-200-700 transition-colors flex-shrink-0"
									onclick={() => toggleAreaTypeVisibility(areaType.area_type)}
									aria-label={visible ? 'Hide area type' : 'Show area type'}
									title={visible ? 'Hide area type' : 'Show area type'}
								>
									{#if visible}
										<IconEye size="24" class="text-primary-500" />
									{:else}
										<IconEyeOff size="24" class="text-surface-400" />
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if layerVisibility.size === 0}
			<p class="text-sm md:text-xs text-surface-400 italic text-center py-2">
				{m.form_no_layers_available()}
			</p>
		{/if}
	</div>
</div>
