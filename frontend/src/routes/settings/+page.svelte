<script>
	import { Slider, Switch } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import {
		DEFAULT_ADDRESS_COLOR,
		DEFAULT_ADDRESS_SIZE,
		DEFAULT_NODE_COLOR,
		DEFAULT_NODE_SIZE,
		DEFAULT_TRENCH_COLOR
	} from '$lib/map/styles';
	import { userStore } from '$lib/stores/auth';
	import {
		addressStyle,
		nodeTypeStyles,
		routingTolerance,
		sidebarExpanded,
		trenchColor,
		trenchColorSelected,
		trenchConstructionTypeStyles,
		trenchStyleMode,
		trenchSurfaceStyles
	} from '$lib/stores/store';

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	let routingToleranceMarkers = $derived(Array.from({ length: 10 }, (_, i) => i + 1));

	// Initialize styles for any new node types from server data
	$effect(() => {
		if (data.nodeTypes && data.nodeTypes.length > 0) {
			const currentStyles = $nodeTypeStyles;
			let hasNewTypes = false;

			data.nodeTypes.forEach((nodeType) => {
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

	// Initialize styles for any new surface types from server data
	$effect(() => {
		if (data.surfaces && data.surfaces.length > 0) {
			const currentStyles = $trenchSurfaceStyles;
			let hasNewTypes = false;

			data.surfaces.forEach((surface) => {
				if (!currentStyles[surface.surface]) {
					currentStyles[surface.surface] = {
						color: DEFAULT_TRENCH_COLOR,
						visible: true
					};
					hasNewTypes = true;
				}
			});

			if (hasNewTypes) {
				$trenchSurfaceStyles = { ...currentStyles };
			}
		}
	});

	// Initialize styles for any new construction types from server data
	$effect(() => {
		if (data.constructionTypes && data.constructionTypes.length > 0) {
			const currentStyles = $trenchConstructionTypeStyles;
			let hasNewTypes = false;

			data.constructionTypes.forEach((constructionType) => {
				if (!currentStyles[constructionType.construction_type]) {
					currentStyles[constructionType.construction_type] = {
						color: DEFAULT_TRENCH_COLOR,
						visible: true
					};
					hasNewTypes = true;
				}
			});

			if (hasNewTypes) {
				$trenchConstructionTypeStyles = { ...currentStyles };
			}
		}
	});

	function updateNodeTypeColor(nodeTypeName, color) {
		const currentStyles = $nodeTypeStyles;
		$nodeTypeStyles = {
			...currentStyles,
			[nodeTypeName]: {
				...currentStyles[nodeTypeName],
				color
			}
		};
	}

	function updateNodeTypeSize(nodeTypeName, size) {
		const currentStyles = $nodeTypeStyles;
		$nodeTypeStyles = {
			...currentStyles,
			[nodeTypeName]: {
				...currentStyles[nodeTypeName],
				size: size[0]
			}
		};
	}

	function resetNodeTypeStyle(nodeTypeName) {
		const currentStyles = $nodeTypeStyles;
		$nodeTypeStyles = {
			...currentStyles,
			[nodeTypeName]: {
				color: DEFAULT_NODE_COLOR,
				size: DEFAULT_NODE_SIZE,
				visible: currentStyles[nodeTypeName]?.visible ?? true
			}
		};
	}

	function resetAllNodeTypeStyles() {
		const newStyles = {};
		data.nodeTypes.forEach((nodeType) => {
			newStyles[nodeType.node_type] = {
				color: DEFAULT_NODE_COLOR,
				size: DEFAULT_NODE_SIZE,
				visible: $nodeTypeStyles[nodeType.node_type]?.visible ?? true
			};
		});
		$nodeTypeStyles = newStyles;
	}

	function getNodeTypeStyle(nodeTypeName) {
		return (
			$nodeTypeStyles[nodeTypeName] || {
				color: DEFAULT_NODE_COLOR,
				size: DEFAULT_NODE_SIZE,
				visible: true
			}
		);
	}

	// Surface style functions
	function updateSurfaceColor(surfaceName, color) {
		const currentStyles = $trenchSurfaceStyles;
		$trenchSurfaceStyles = {
			...currentStyles,
			[surfaceName]: {
				...currentStyles[surfaceName],
				color
			}
		};
	}

	function resetSurfaceStyle(surfaceName) {
		const currentStyles = $trenchSurfaceStyles;
		$trenchSurfaceStyles = {
			...currentStyles,
			[surfaceName]: {
				color: DEFAULT_TRENCH_COLOR,
				visible: currentStyles[surfaceName]?.visible ?? true
			}
		};
	}

	function resetAllSurfaceStyles() {
		const newStyles = {};
		data.surfaces.forEach((surface) => {
			newStyles[surface.surface] = {
				color: DEFAULT_TRENCH_COLOR,
				visible: $trenchSurfaceStyles[surface.surface]?.visible ?? true
			};
		});
		$trenchSurfaceStyles = newStyles;
	}

	function getSurfaceStyle(surfaceName) {
		return (
			$trenchSurfaceStyles[surfaceName] || {
				color: DEFAULT_TRENCH_COLOR,
				visible: true
			}
		);
	}

	// Construction type style functions
	function updateConstructionTypeColor(constructionTypeName, color) {
		const currentStyles = $trenchConstructionTypeStyles;
		$trenchConstructionTypeStyles = {
			...currentStyles,
			[constructionTypeName]: {
				...currentStyles[constructionTypeName],
				color
			}
		};
	}

	function resetConstructionTypeStyle(constructionTypeName) {
		const currentStyles = $trenchConstructionTypeStyles;
		$trenchConstructionTypeStyles = {
			...currentStyles,
			[constructionTypeName]: {
				color: DEFAULT_TRENCH_COLOR,
				visible: currentStyles[constructionTypeName]?.visible ?? true
			}
		};
	}

	function resetAllConstructionTypeStyles() {
		const newStyles = {};
		data.constructionTypes.forEach((constructionType) => {
			newStyles[constructionType.construction_type] = {
				color: DEFAULT_TRENCH_COLOR,
				visible: $trenchConstructionTypeStyles[constructionType.construction_type]?.visible ?? true
			};
		});
		$trenchConstructionTypeStyles = newStyles;
	}

	function getConstructionTypeStyle(constructionTypeName) {
		return (
			$trenchConstructionTypeStyles[constructionTypeName] || {
				color: DEFAULT_TRENCH_COLOR,
				visible: true
			}
		);
	}

	// Address style functions
	function updateAddressColor(color) {
		$addressStyle = {
			...$addressStyle,
			color
		};
	}

	function updateAddressSize(size) {
		$addressStyle = {
			...$addressStyle,
			size: size[0]
		};
	}

	function resetAddressStyle() {
		$addressStyle = {
			color: DEFAULT_ADDRESS_COLOR,
			size: DEFAULT_ADDRESS_SIZE
		};
	}
</script>

<svelte:head>
	<title>{m.nav_settings()}</title>
</svelte:head>

<div class="mx-auto max-w-7xl pt-16 lg:flex lg:gap-x-16 lg:px-8">
	<h1 class="sr-only">User Settings</h1>

	<main class="px-4 py-16 sm:px-6 lg:flex-auto lg:px-0 lg:py-20">
		<div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-none space-y-16 sm:space-y-20 pb-20">
			<!-- User Settings -->
			<div>
				<h2 class="text-base/7 font-semibold text-primary-900-100">
					{m.settings_user()}
				</h2>

				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.auth_username()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<div>{$userStore.username}</div>
						</dd>
					</div>
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_user_email()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<div>{$userStore.email}</div>
						</dd>
					</div>
				</dl>
			</div>

			<!-- UI Settings -->
			<div>
				<h2 class="text-base/7 font-semibold text-primary-900-100">
					{m.settings_ui()}
				</h2>

				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">Sidebar</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							{#if $sidebarExpanded}
								<p>{m.settings_ui_sidebar_expanded()}</p>
							{:else}
								<p>{m.settings_ui_sidebar_collapsed()}</p>
							{/if}
							<Switch
								name="sidebar-expanded"
								checked={$sidebarExpanded}
								onCheckedChange={() => {
									$sidebarExpanded = !$sidebarExpanded;
								}}
							>
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
								<Switch.HiddenInput />
							</Switch>
						</dd>
					</div>
				</dl>
			</div>

			<!-- Map Settings -->
			<div>
				<h2 class="text-base/7 font-semibold text-primary-900-100">{m.settings_map()}</h2>
				<dl class="mt-6 divide-y border-t text-sm/6">
					<!-- Selected Feature Color -->
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_map_selected_feature_color()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<input type="color" bind:value={$trenchColorSelected} />
							<button
								name="reset-trench-color-selected"
								type="button"
								class="font-semibold text-primary-500 hover:text-primary-600-400"
								onclick={() => {
									$trenchColorSelected = '#fbb483';
								}}
							>
								Reset
							</button>
						</dd>
					</div>
					<!-- Trench Color -->
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_map_trench_color()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<input type="color" bind:value={$trenchColor} />
							<button
								name="reset-trench-color"
								type="button"
								class="font-semibold text-primary-500 hover:text-primary-600-400"
								onclick={() => {
									$trenchColor = '#fbb483';
								}}
							>
								Reset
							</button>
						</dd>
					</div>
					<!-- Trench Style Mode -->
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_trench_style_mode()}
						</dt>
						<dd class="mt-1 flex gap-x-4 sm:mt-0 sm:flex-auto">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="trench-style-mode"
									value="none"
									checked={$trenchStyleMode === 'none'}
									onchange={() => ($trenchStyleMode = 'none')}
									class="radio"
								/>
								<span class="text-sm">{m.settings_trench_style_none()}</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="trench-style-mode"
									value="surface"
									checked={$trenchStyleMode === 'surface'}
									onchange={() => ($trenchStyleMode = 'surface')}
									class="radio"
								/>
								<span class="text-sm">{m.settings_trench_style_by_surface()}</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="trench-style-mode"
									value="construction_type"
									checked={$trenchStyleMode === 'construction_type'}
									onchange={() => ($trenchStyleMode = 'construction_type')}
									class="radio"
								/>
								<span class="text-sm">{m.settings_trench_style_by_construction_type()}</span>
							</label>
						</dd>
					</div>
				</dl>
			</div>

			<!-- Surface Styles (only show when trenchStyleMode === 'surface') -->
			{#if $trenchStyleMode === 'surface'}
				<div>
					<div class="flex items-center justify-between">
						<h2 class="text-base/7 font-semibold text-primary-900-100">
							{m.settings_surface_styles()}
						</h2>
						{#if data.surfaces && data.surfaces.length > 0}
							<button
								type="button"
								class="font-semibold text-sm text-primary-500 hover:text-primary-600-400"
								onclick={resetAllSurfaceStyles}
							>
								{m.common_reset_all()}
							</button>
						{/if}
					</div>

					{#if data.surfacesError}
						<div class="mt-6 text-sm text-error-500">{data.surfacesError}</div>
					{:else if !data.surfaces || data.surfaces.length === 0}
						<div class="mt-6 text-sm">{m.form_no_data_available()}</div>
					{:else}
						<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each data.surfaces as surface}
								{@const style = getSurfaceStyle(surface.surface)}
								<div
									class="card preset-filled-surface-100-900 relative group rounded-lg border border-surface-200-800 p-4 hover:border-surface-400-600 transition-colors"
								>
									<!-- Header with name and reset -->
									<div class="flex items-center justify-between mb-4">
										<h3 class="font-medium text-sm truncate pr-2">{surface.surface}</h3>
										<button
											type="button"
											class="text-xs hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"
											onclick={() => resetSurfaceStyle(surface.surface)}
										>
											Reset
										</button>
									</div>

									<!-- Visual preview (line style) -->
									<div
										class="flex items-center justify-center mb-4 py-3 bg-surface-100-800 rounded"
									>
										<span
											class="h-1 w-16 rounded shadow-sm transition-all"
											style="background-color: {style.color};"
										></span>
									</div>

									<!-- Controls -->
									<div class="space-y-3">
										<!-- Color -->
										<div class="flex items-center gap-3">
											<label class="relative cursor-pointer">
												<input
													type="color"
													value={style.color}
													onchange={(e) => updateSurfaceColor(surface.surface, e.target.value)}
													class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
												/>
												<span
													class="block w-8 h-8 rounded-md border-2 border-surface-200-700 hover:border-primary-500 transition-colors shadow-sm"
													style="background-color: {style.color};"
												></span>
											</label>
											<span class="text-xs flex-1">{m.settings_node_type_color()}</span>
											<span class="text-xs font-mono">{style.color}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Construction Type Styles (only show when trenchStyleMode === 'construction_type') -->
			{#if $trenchStyleMode === 'construction_type'}
				<div>
					<div class="flex items-center justify-between">
						<h2 class="text-base/7 font-semibold text-primary-900-100">
							{m.settings_construction_type_styles()}
						</h2>
						{#if data.constructionTypes && data.constructionTypes.length > 0}
							<button
								type="button"
								class="font-semibold text-sm text-primary-500 hover:text-primary-600-400"
								onclick={resetAllConstructionTypeStyles}
							>
								{m.common_reset_all()}
							</button>
						{/if}
					</div>

					{#if data.constructionTypesError}
						<div class="mt-6 text-sm text-error-500">{data.constructionTypesError}</div>
					{:else if !data.constructionTypes || data.constructionTypes.length === 0}
						<div class="mt-6 text-sm">{m.form_no_data_available()}</div>
					{:else}
						<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each data.constructionTypes as constructionType}
								{@const style = getConstructionTypeStyle(constructionType.construction_type)}
								<div
									class="card preset-filled-surface-100-900 relative group rounded-lg border border-surface-200-800 p-4 hover:border-surface-400-600 transition-colors"
								>
									<!-- Header with name and reset -->
									<div class="flex items-center justify-between mb-4">
										<h3 class="font-medium text-sm truncate pr-2">
											{constructionType.construction_type}
										</h3>
										<button
											type="button"
											class="text-xs hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"
											onclick={() => resetConstructionTypeStyle(constructionType.construction_type)}
										>
											Reset
										</button>
									</div>

									<!-- Visual preview (line style) -->
									<div
										class="flex items-center justify-center mb-4 py-3 bg-surface-100-800 rounded"
									>
										<span
											class="h-1 w-16 rounded shadow-sm transition-all"
											style="background-color: {style.color};"
										></span>
									</div>

									<!-- Controls -->
									<div class="space-y-3">
										<!-- Color -->
										<div class="flex items-center gap-3">
											<label class="relative cursor-pointer">
												<input
													type="color"
													value={style.color}
													onchange={(e) =>
														updateConstructionTypeColor(
															constructionType.construction_type,
															e.target.value
														)}
													class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
												/>
												<span
													class="block w-8 h-8 rounded-md border-2 border-surface-200-700 hover:border-primary-500 transition-colors shadow-sm"
													style="background-color: {style.color};"
												></span>
											</label>
											<span class="text-xs flex-1">{m.settings_node_type_color()}</span>
											<span class="text-xs font-mono">{style.color}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Node Type Styles -->
			<div>
				<div class="flex items-center justify-between">
					<h2 class="text-base/7 font-semibold text-primary-900-100">
						{m.settings_node_type_styles()}
					</h2>
					{#if data.nodeTypes.length > 0}
						<button
							type="button"
							class="font-semibold text-sm text-primary-500 hover:text-primary-600-400"
							onclick={resetAllNodeTypeStyles}
						>
							{m.common_reset_all()}
						</button>
					{/if}
				</div>

				{#if data.nodeTypesError}
					<div class="mt-6 text-sm text-error-500">{data.nodeTypesError}</div>
				{:else if data.nodeTypes.length === 0}
					<div class="mt-6 text-sm">{m.form_no_data_available()}</div>
				{:else}
					<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each data.nodeTypes as nodeType}
							{@const style = getNodeTypeStyle(nodeType.node_type)}
							<div
								class="card preset-filled-surface-100-900 relative group rounded-lg border border-surface-200-800 p-4 hover:border-surface-400-600 transition-colors"
							>
								<!-- Header with name and reset -->
								<div class="flex items-center justify-between mb-4">
									<h3 class="font-medium text-sm truncate pr-2">{nodeType.node_type}</h3>
									<button
										type="button"
										class="text-xs hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"
										onclick={() => resetNodeTypeStyle(nodeType.node_type)}
									>
										Reset
									</button>
								</div>

								<!-- Visual preview -->
								<div class="flex items-center justify-center mb-4 py-3 bg-surface-100-800 rounded">
									<span
										class="rounded-full shadow-sm transition-all"
										style="background-color: {style.color}; width: {style.size *
											4}px; height: {style.size * 4}px;"
									></span>
								</div>

								<!-- Controls -->
								<div class="space-y-3">
									<!-- Color -->
									<div class="flex items-center gap-3">
										<label class="relative cursor-pointer">
											<input
												type="color"
												value={style.color}
												onchange={(e) => updateNodeTypeColor(nodeType.node_type, e.target.value)}
												class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
											/>
											<span
												class="block w-8 h-8 rounded-md border-2 border-surface-200-700 hover:border-primary-500 transition-colors shadow-sm"
												style="background-color: {style.color};"
											></span>
										</label>
										<span class="text-xs flex-1">{m.settings_node_type_color()}</span>
										<span class="text-xs font-mono">{style.color}</span>
									</div>

									<!-- Size -->
									<div class="flex items-center gap-3">
										<span class="text-xs w-16">{m.settings_node_type_size()}</span>
										<div class="flex-1">
											<Slider
												value={[style.size]}
												onValueChange={(e) => updateNodeTypeSize(nodeType.node_type, e.value)}
												max={30}
												min={3}
											>
												<Slider.Control>
													<Slider.Track>
														<Slider.Range class="bg-primary-500" />
													</Slider.Track>
													<Slider.Thumb index={0} class="ring-primary-500">
														<Slider.HiddenInput />
													</Slider.Thumb>
												</Slider.Control>
											</Slider>
										</div>
										<span class="text-xs font-mono w-4 text-right">{style.size}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Address Style -->
			<div>
				<div class="flex items-center justify-between">
					<h2 class="text-base/7 font-semibold text-primary-900-100">
						{m.settings_address_style()}
					</h2>
					<button
						type="button"
						class="font-semibold text-sm text-primary-500 hover:text-primary-600-400"
						onclick={resetAddressStyle}
					>
						{m.common_reset_all()}
					</button>
				</div>

				<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					<div
						class="card preset-filled-surface-100-900 relative group rounded-lg border border-surface-200-800 p-4 hover:border-surface-400-600 transition-colors"
					>
						<!-- Header with name and reset -->
						<div class="flex items-center justify-between mb-4">
							<h3 class="font-medium text-sm truncate pr-2">Address Points</h3>
							<button
								type="button"
								class="text-xs hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"
								onclick={resetAddressStyle}
							>
								Reset
							</button>
						</div>

						<!-- Visual preview -->
						<div class="flex items-center justify-center mb-4 py-3 bg-surface-100-800 rounded">
							<span
								class="rounded-full shadow-sm transition-all"
								style="background-color: {$addressStyle.color}; width: {$addressStyle.size *
									4}px; height: {$addressStyle.size * 4}px;"
							></span>
						</div>

						<!-- Controls -->
						<div class="space-y-3">
							<!-- Color -->
							<div class="flex items-center gap-3">
								<label class="relative cursor-pointer">
									<input
										type="color"
										value={$addressStyle.color}
										onchange={(e) => updateAddressColor(e.target.value)}
										class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
									/>
									<span
										class="block w-8 h-8 rounded-md border-2 border-surface-200-700 hover:border-primary-500 transition-colors shadow-sm"
										style="background-color: {$addressStyle.color};"
									></span>
								</label>
								<span class="text-xs flex-1">{m.settings_node_type_color()}</span>
								<span class="text-xs font-mono">{$addressStyle.color}</span>
							</div>

							<!-- Size -->
							<div class="flex items-center gap-3">
								<span class="text-xs w-16">{m.settings_node_type_size()}</span>
								<div class="flex-1">
									<Slider
										value={[$addressStyle.size]}
										onValueChange={(e) => updateAddressSize(e.value)}
										max={30}
										min={3}
									>
										<Slider.Control>
											<Slider.Track>
												<Slider.Range class="bg-primary-500" />
											</Slider.Track>
											<Slider.Thumb index={0} class="ring-primary-500">
												<Slider.HiddenInput />
											</Slider.Thumb>
										</Slider.Control>
									</Slider>
								</div>
								<span class="text-xs font-mono w-4 text-right">{$addressStyle.size}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Conduit Connection Settings -->
			<div>
				<h2 class="text-base/7 font-semibold text-primary-900-100">
					{m.settings_conduit_connection()}
				</h2>

				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_routing_tolerance()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<p class="hidden md:block">{m.settings_routing_tolerance_description()}</p>
							<Slider
								value={$routingTolerance}
								onValueChange={(e) => ($routingTolerance = e.value)}
								max={10}
								min={1}
							>
								<Slider.Control>
									<Slider.Track>
										<Slider.Range class="bg-primary-500" />
									</Slider.Track>
									<Slider.Thumb index={0} class="ring-primary-500">
										<Slider.HiddenInput />
									</Slider.Thumb>
								</Slider.Control>
								<Slider.MarkerGroup>
									{#each routingToleranceMarkers as marker}
										<Slider.Marker value={marker} />
									{/each}
								</Slider.MarkerGroup>
							</Slider>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</main>
</div>
