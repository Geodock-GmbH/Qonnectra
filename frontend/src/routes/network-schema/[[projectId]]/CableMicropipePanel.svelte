<script>
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/stores';
	import {
		IconArrowLeft,
		IconCheck,
		IconLink,
		IconLinkOff,
		IconLoader,
		IconSquare,
		IconSquareCheck
	} from '@tabler/icons-svelte';
	import VectorTileLayer from 'ol/layer/VectorTile.js';

	import { m } from '$lib/paraglide/messages';

	import { CableMicropipeManager } from '$lib/classes/CableMicropipeManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte.js';
	import Map from '$lib/components/Map.svelte';
	import { createSelectedStyle } from '$lib/map/styles.js';
	import {
		areaTypeStyles,
		labelVisibilityConfig,
		nodeTypeStyles,
		trenchColor,
		trenchConstructionTypeStyles,
		trenchStyleMode,
		trenchSurfaceStyles
	} from '$lib/stores/store';

	import 'ol/ol.css';

	let { cableId, cableName, onClose = () => {} } = $props();

	const manager = new CableMicropipeManager();

	/** @type {import('ol').Map|undefined} */
	let olMap = $state();
	/** @type {import('ol/interaction/DragBox').default|undefined} */
	let dragBoxInteraction = $state();
	/** @type {VectorTileLayer|undefined} */
	let selectionLayer = $state();
	/** @type {SvelteSet<string>} Selected feature IDs for highlighting */
	let selectedFeatureIds = $state(new SvelteSet());

	// Initialize MapState for this panel
	const projectId = $page.params.projectId;
	const mapState = new MapState(projectId);
	const layersInitialized = mapState.initializeLayers();

	/** @type {string|null} */
	let previousCableId = $state(null);

	/**
	 * Reinitialize when cableId changes (like NodeStructurePanel does with nodeUuid)
	 */
	$effect(() => {
		if (cableId && cableId !== previousCableId) {
			previousCableId = cableId;
			manager.initialize(cableId, cableName);
			// Clear map selection when switching cables
			selectedFeatureIds = new SvelteSet();
			if (selectionLayer) {
				selectionLayer.changed();
			}
		}
	});

	onDestroy(() => {
		cleanup();
	});

	// Update node layer style when nodeTypeStyles changes
	$effect(() => {
		const styles = $nodeTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateNodeLayerStyle(styles);
		}
	});

	// Update trench layer style when trench style settings change
	$effect(() => {
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		mapState.updateTrenchLayerStyle(mode, surfaceStyles, constructionTypeStyles, color);
	});

	// Update area layer style when areaTypeStyles changes
	$effect(() => {
		const styles = $areaTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateAreaLayerStyle(styles);
		}
	});

	// Update label visibility when labelVisibilityConfig changes
	$effect(() => {
		const config = $labelVisibilityConfig;
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		const nodeStyles = $nodeTypeStyles;
		const areaStyles = $areaTypeStyles;

		if (config.trench !== undefined) {
			mapState.updateLabelVisibility('trench', config.trench, {
				mode,
				surfaceStyles,
				constructionTypeStyles,
				color
			});
		}
		if (config.conduit !== undefined) {
			mapState.updateLabelVisibility('conduit', config.conduit, {
				mode,
				surfaceStyles,
				constructionTypeStyles,
				color
			});
		}
		if (config.address !== undefined) {
			mapState.updateLabelVisibility('address', config.address, {});
		}
		if (config.node !== undefined) {
			mapState.updateLabelVisibility('node', config.node, { nodeTypeStyles: nodeStyles });
		}
		if (config.area !== undefined) {
			mapState.updateLabelVisibility('area', config.area, { areaTypeStyles: areaStyles });
		}
	});

	/**
	 * Handle map ready event
	 */
	async function handleMapReady(event) {
		olMap = event.detail.map;
		mapState.olMap = olMap;

		// Create selection layer for highlighting selected trenches
		const selectedStyle = createSelectedStyle('#ff6600');
		selectionLayer = new VectorTileLayer({
			renderMode: 'vector',
			source: mapState.vectorTileLayer.getSource(),
			style: function (feature) {
				const featureId = String(feature.getId() || feature.get('uuid'));
				if (featureId && selectedFeatureIds.has(featureId)) {
					return selectedStyle;
				}
				return undefined;
			},
			visible: true,
			properties: {
				isSelectionLayer: true
			}
		});
		olMap.addLayer(selectionLayer);

		await setupInteractions();
	}

	/**
	 * Setup custom interactions for trench selection
	 */
	async function setupInteractions() {
		if (!olMap || !mapState.vectorTileLayer) return;

		const [{ default: DragBox }, { shiftKeyOnly }] = await Promise.all([
			import('ol/interaction/DragBox'),
			import('ol/events/condition')
		]);

		// Handle single click for feature selection
		olMap.on('click', (evt) => {
			const features = olMap.getFeaturesAtPixel(evt.pixel, {
				hitTolerance: 10,
				layerFilter: (layer) => layer === mapState.vectorTileLayer
			});

			if (features && features.length > 0) {
				const feature = features[0];
				const featureId = String(feature.getId() || feature.get('uuid'));

				if (featureId) {
					const newSet = new SvelteSet(selectedFeatureIds);
					if (newSet.has(featureId)) {
						newSet.delete(featureId);
					} else {
						newSet.add(featureId);
					}
					selectedFeatureIds = newSet;
					if (selectionLayer) {
						selectionLayer.changed();
					}
					syncSelectionToManager();
				}
			}
		});

		// DragBox for rectangle selection
		dragBoxInteraction = new DragBox({
			condition: shiftKeyOnly
		});

		dragBoxInteraction.on('boxend', () => {
			const extent = dragBoxInteraction.getGeometry().getExtent();
			const newSet = new SvelteSet(selectedFeatureIds);
			const boxPixelMin = olMap.getPixelFromCoordinate([extent[0], extent[1]]);
			const boxPixelMax = olMap.getPixelFromCoordinate([extent[2], extent[3]]);

			const stepX = Math.max(1, Math.floor((boxPixelMax[0] - boxPixelMin[0]) / 20));
			const stepY = Math.max(1, Math.floor((boxPixelMin[1] - boxPixelMax[1]) / 20));

			for (let x = boxPixelMin[0]; x <= boxPixelMax[0]; x += stepX) {
				for (let y = boxPixelMax[1]; y <= boxPixelMin[1]; y += stepY) {
					const features = olMap.getFeaturesAtPixel([x, y], {
						hitTolerance: 10,
						layerFilter: (layer) => layer === mapState.vectorTileLayer
					});
					if (features) {
						features.forEach((feature) => {
							const featureId = String(feature.getId() || feature.get('uuid'));
							if (featureId) {
								newSet.add(featureId);
							}
						});
					}
				}
			}

			selectedFeatureIds = newSet;
			if (selectionLayer) {
				selectionLayer.changed();
			}
			syncSelectionToManager();
		});

		olMap.addInteraction(dragBoxInteraction);
	}

	/**
	 * Sync map selection to manager
	 */
	function syncSelectionToManager() {
		const ids = Array.from(selectedFeatureIds);
		manager.handleTrenchSelection(ids);
	}

	/**
	 * Clear map selection
	 */
	function clearMapSelection() {
		selectedFeatureIds = new SvelteSet();
		if (selectionLayer) {
			selectionLayer.changed();
		}
		manager.clearTrenchSelection();
	}

	/**
	 * Cleanup resources
	 */
	function cleanup() {
		if (olMap && dragBoxInteraction) {
			olMap.removeInteraction(dragBoxInteraction);
			dragBoxInteraction = undefined;
		}
		if (olMap && selectionLayer) {
			olMap.removeLayer(selectionLayer);
			selectionLayer = undefined;
		}
		mapState.cleanup();
		olMap = undefined;
		selectedFeatureIds = new SvelteSet();
	}

	/**
	 * Check if conduit is selected
	 * @param {string} conduitId
	 * @returns {boolean}
	 */
	function isConduitSelected(conduitId) {
		return manager.selectedConduitIds.has(conduitId);
	}

	/**
	 * Check if micropipe is the selected one
	 * @param {Object} micropipe
	 * @returns {boolean}
	 */
	function isMicropipeSelected(micropipe) {
		return (
			manager.selectedMicropipe?.number === micropipe.number &&
			manager.selectedMicropipe?.color_name === micropipe.color_name
		);
	}
</script>

<div class="h-full w-full flex">
	<!-- Left: Map -->
	<div class="flex-1 min-w-0 h-full relative">
		{#if layersInitialized}
			<Map
				className="h-full w-full"
				layers={mapState.getLayers()}
				variant="fullscreen"
				showSearchPanel={true}
				showLayerVisibilityTree={true}
				showOpacitySlider={true}
				on:ready={handleMapReady}
			/>
		{:else}
			<div class="flex items-center justify-center h-full bg-surface-100-900">
				<IconLoader class="size-8 animate-spin text-primary-500" />
			</div>
		{/if}
	</div>

	<!-- Right: Selection Panel -->
	<div
		class="w-96 shrink-0 flex flex-col border-l border-surface-200-800 bg-surface-50-950 overflow-hidden"
	>
		<!-- Header -->
		<div class="shrink-0 p-4 border-b border-surface-200-800">
			<h3 class="text-lg font-semibold">{cableName}</h3>
		</div>

		<!-- Step indicator -->
		<div class="shrink-0 flex items-center gap-2 p-4 border-b border-surface-200-800">
			<button
				type="button"
				class="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors
					{manager.step === 1
					? 'bg-primary-500 text-white'
					: 'bg-surface-200-800 text-surface-600-300 hover:bg-surface-300-700'}"
				onclick={() => manager.goToStep1()}
			>
				<span class="text-sm font-medium">1</span>
				<span class="text-sm">{m.form_selected_trenches()}</span>
			</button>
			<div class="flex-1 h-px bg-surface-300-700"></div>
			<button
				type="button"
				class="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors
					{manager.step === 2 ? 'bg-primary-500 text-white' : 'bg-surface-200-800 text-surface-600-300'}
					{manager.selectedConduitIds.size === 0
					? 'opacity-50 cursor-not-allowed'
					: 'hover:bg-surface-300-700'}"
				onclick={() => manager.selectedConduitIds.size > 0 && manager.goToStep2()}
				disabled={manager.selectedConduitIds.size === 0}
			>
				<span class="text-sm font-medium">2</span>
				<span class="text-sm">{m.form_micropipes()}</span>
			</button>
		</div>

		<!-- Content area -->
		<div class="flex-1 min-h-0 overflow-auto p-4">
			{#if manager.step === 1}
				<!-- Step 1: Conduit Selection -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium">
							{m.form_selected_trenches()}: {manager.selectedTrenchIds.size}
						</span>
						{#if manager.selectedTrenchIds.size > 0}
							<button
								type="button"
								class="text-xs text-primary-500 hover:underline"
								onclick={clearMapSelection}
							>
								{m.action_clear_selection()}
							</button>
						{/if}
					</div>

					{#if manager.selectedTrenchIds.size === 0}
						<div class="text-center py-8 text-surface-500">
							<p>{m.message_select_trenches()}</p>
						</div>
					{:else if manager.loading}
						<div class="flex items-center justify-center p-4">
							<IconLoader class="size-6 animate-spin text-primary-500" />
						</div>
					{:else if manager.conduits.length === 0}
						<div class="text-center py-8 text-surface-500">
							<p>{m.message_no_conduits_in_trenches()}</p>
						</div>
					{:else}
						<div class="space-y-1">
							<p class="text-sm font-medium mb-2">
								{m.form_conduits()}
								<span class="font-normal text-surface-500">({manager.conduits.length})</span>
							</p>
							{#each manager.conduits as conduit (conduit.uuid)}
								<button
									type="button"
									class="w-full flex items-center gap-2 p-2 rounded hover:bg-surface-200-800 transition-colors text-left"
									onclick={() => manager.toggleConduit(conduit.uuid)}
								>
									{#if isConduitSelected(conduit.uuid)}
										<IconSquareCheck class="size-5 text-primary-500 shrink-0" />
									{:else}
										<IconSquare class="size-5 text-surface-400 shrink-0" />
									{/if}
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium truncate">{conduit.name}</div>
										<div class="text-xs text-surface-500 truncate">{conduit.conduit_type_name}</div>
									</div>
									{#if conduit.has_cable_linkage}
										<span
											class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-500/20 text-success-700 dark:text-success-300 text-xs shrink-0"
										>
											<IconLink class="size-3" />
											{m.message_linked()}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<!-- Step 2: Micropipe Selection -->
				<div class="space-y-4">
					<div class="text-sm">
						<span class="font-medium">{m.form_selected_conduits()}:</span>
						{manager.selectedConduitIds.size}
					</div>

					{#if manager.loading}
						<div class="flex items-center justify-center p-8">
							<IconLoader class="size-8 animate-spin text-primary-500" />
						</div>
					{:else if manager.micropipes.length === 0}
						<p class="text-sm text-surface-500 p-4">{m.message_no_conduits_in_trenches()}</p>
					{:else}
						<table class="w-full text-sm">
							<thead class="bg-surface-200-800 sticky top-0">
								<tr>
									<th class="p-2 text-left w-12">#</th>
									<th class="p-2 text-left">{m.form_color()}</th>
									<th class="p-2 text-center">{m.form_available()}</th>
									<th class="p-2 text-center">{m.form_status()}</th>
								</tr>
							</thead>
							<tbody>
								{#each manager.micropipes as mp (mp.number + '-' + mp.color_name)}
									{@const isAvailable = mp.available_in_all}
									{@const isSelected = isMicropipeSelected(mp)}
									<tr
										class="border-b border-surface-200-800 transition-colors
											{isAvailable ? 'hover:bg-surface-200-800 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
											{isSelected ? 'bg-primary-500/20' : ''}"
										onclick={() => isAvailable && manager.selectMicropipe(mp)}
										role="button"
										tabindex={isAvailable ? 0 : -1}
										onkeydown={(e) => {
											if (isAvailable && (e.key === 'Enter' || e.key === ' ')) {
												e.preventDefault();
												manager.selectMicropipe(mp);
											}
										}}
									>
										<td class="p-2 font-mono">{mp.number}</td>
										<td class="p-2">
											<div class="flex items-center gap-2">
												<div
													class="w-4 h-4 rounded border border-surface-300-700"
													style="background-color: {mp.color_hex}"
												></div>
												<span>{mp.color_name}</span>
											</div>
										</td>
										<td class="p-2 text-center">
											{#if isAvailable}
												<IconCheck class="size-5 text-success-500 mx-auto" />
											{:else}
												<span
													class="text-xs text-warning-500"
													title={m.message_micropipe_not_in_conduit({
														conduits: mp.missing_in.join(', ')
													})}
												>
													{mp.available_in.length}/{manager.selectedConduitIds.size}
												</span>
											{/if}
										</td>
										<td class="p-2 text-center">
											{#if mp.linked_to_cable}
												<div class="flex items-center justify-center gap-1">
													<span
														class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-500/20 text-success-700 dark:text-success-300 text-xs"
													>
														<IconLink class="size-3" />
														{m.message_linked()}
													</span>
													<button
														type="button"
														class="p-1 rounded hover:bg-error-500/20 text-error-500 transition-colors"
														title={m.action_remove_linkage()}
														onclick={(e) => {
															e.stopPropagation();
															manager.removeLinkage(mp.number, mp.available_in);
														}}
														disabled={manager.saving}
													>
														<IconLinkOff class="size-4" />
													</button>
												</div>
											{:else if isSelected}
												<IconSquareCheck class="size-5 text-primary-500 mx-auto" />
											{:else}
												<IconSquare class="size-5 text-surface-400 mx-auto" />
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer with actions -->
		<div class="shrink-0 p-4 border-t border-surface-200-800 flex flex-col gap-2">
			{#if manager.step === 1}
				<button
					type="button"
					class="btn w-full preset-filled-primary-500"
					onclick={() => manager.goToStep2()}
					disabled={manager.selectedConduitIds.size === 0 || manager.loading}
				>
					{m.action_next()}
				</button>
				<div class="flex gap-2">
					<button
						type="button"
						class="btn flex-1 preset-outlined"
						onclick={clearMapSelection}
						disabled={manager.selectedTrenchIds.size === 0}
					>
						{m.action_clear_selection()}
					</button>
					<button type="button" class="btn flex-1 preset-outlined" onclick={onClose}>
						{m.common_cancel()}
					</button>
				</div>
			{:else}
				<button
					type="button"
					class="btn w-full preset-filled-primary-500"
					onclick={() => manager.saveLinkage()}
					disabled={!manager.selectedMicropipe || manager.saving}
				>
					{#if manager.saving}
						<IconLoader class="size-4 animate-spin" />
					{:else}
						<IconCheck class="size-4" />
					{/if}
					{m.action_save()}
				</button>
				<div class="flex gap-2">
					<button
						type="button"
						class="btn flex-1 preset-outlined"
						onclick={() => manager.goToStep1()}
						disabled={manager.saving}
					>
						<IconArrowLeft class="size-4" />
						{m.action_back()}
					</button>
					<button type="button" class="btn flex-1 preset-outlined" onclick={onClose}>
						{m.common_cancel()}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
