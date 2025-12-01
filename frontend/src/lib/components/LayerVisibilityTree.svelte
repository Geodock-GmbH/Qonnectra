<script>
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import {
		IconChevronDown,
		IconChevronRight,
		IconChevronUp,
		IconEye,
		IconEyeOff
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { DEFAULT_NODE_COLOR, DEFAULT_NODE_SIZE } from '$lib/map/styles';
	import { nodeTypeStyles } from '$lib/stores/store';

	let {
		layers = [],
		osmLayer = null,
		nodeTypes = [],
		onLayerVisibilityChanged = () => {},
		onNodeTypeVisibilityChanged = () => {}
	} = $props();

	let layerVisibility = $state(new Map());
	let isCollapsed = $state(false);
	let isNodeSubtypesExpanded = $state(false);

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

	// Update layer visibility when layers change
	$effect(() => {
		const newVisibility = new Map();

		// Add OSM layer if provided
		if (osmLayer) {
			newVisibility.set('osm-base-layer', {
				layer: osmLayer,
				visible: osmLayer.getVisible(),
				name: m.common_osm()
			});
		}

		layers.forEach((layer, index) => {
			const layerId = layer.get('layerId');
			const layerName = layer.get('layerName');

			if (layerId && layerName) {
				newVisibility.set(layerId, {
					layer: layer,
					visible: layer.getVisible(),
					name: layerName
				});
			}
		});

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
</script>

<!-- LayerVisibilityTree -->
<div
	class="w-full max-w-sm md:w-64 p-3 md:p-2 border-1 border-surface-200-800 bg-surface-50-950 rounded-md shadow-lg md:shadow"
>
	<!-- Header with collapse functionality for mobile -->
	<div class="flex items-center justify-between md:mb-2">
		<p class="text-sm font-medium text-surface-contrast-100-900">{m.form_layer_visibility()}</p>

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
								class="p-0.5 rounded hover:bg-surface-200-700 transition-colors flex-shrink-0"
								onclick={toggleNodeSubtypes}
								aria-label={isNodeSubtypesExpanded ? 'Collapse node types' : 'Expand node types'}
							>
								{#if isNodeSubtypesExpanded}
									<IconChevronDown size="14" class="text-surface-500" />
								{:else}
									<IconChevronRight size="14" class="text-surface-500" />
								{/if}
							</button>
						{:else}
							<span class="w-5 flex-shrink-0"></span>
						{/if}

						{#if layerInfo.visible}
							<IconEye size="18" class="text-primary-900-100 flex-shrink-0" />
						{:else}
							<IconEyeOff size="18" class="text-surface-900-100 flex-shrink-0" />
						{/if}
						<span class="text-sm md:text-xs px-2 md:px-0 text-surface-contrast-100-900 truncate">
							{layerInfo.name}
						</span>
					</div>

					<Switch
						name="layer-visibility-{layerId}"
						size="sm"
						checked={layerInfo.visible}
						onCheckedChange={() => toggleLayerVisibility(layerId)}
						class="flex-shrink-0"
					>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
						<Switch.HiddenInput />
					</Switch>
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

									{#if visible}
										<IconEye size="14" class="text-primary-900-100 flex-shrink-0" />
									{:else}
										<IconEyeOff size="14" class="text-surface-900-100 flex-shrink-0" />
									{/if}
									<span
										class="text-xs text-surface-contrast-100-900 truncate"
										title={nodeType.node_type}
									>
										{nodeType.node_type}
									</span>
								</div>

								<Switch
									name="node-type-visibility-{nodeType.id}"
									size="sm"
									checked={visible}
									onCheckedChange={() => toggleNodeTypeVisibility(nodeType.node_type)}
									class="flex-shrink-0"
								>
									<Switch.Control>
										<Switch.Thumb />
									</Switch.Control>
									<Switch.HiddenInput />
								</Switch>
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
