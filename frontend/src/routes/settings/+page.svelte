<script>
	import { Slider, Switch } from '@skeletonlabs/skeleton-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { DEFAULT_NODE_COLOR, DEFAULT_NODE_SIZE } from '$lib/map/styles';
	import { userStore } from '$lib/stores/auth';
	import {
		nodeTypeStyles,
		routingTolerance,
		sidebarExpanded,
		theme,
		trenchColor,
		trenchColorSelected
	} from '$lib/stores/store';

	const themes = [{ label: 'Legacy', value: 'legacy' }];

	let routingToleranceMarkers = $derived(Array.from({ length: 10 }, (_, i) => i + 1));
	let sizeMarkers = $derived(Array.from({ length: 28 }, (_, i) => i + 3)); // 3-30

	// Node types from API
	let nodeTypes = $state([]);
	let nodeTypesLoading = $state(true);
	let nodeTypesError = $state(null);

	// Fetch node types on mount
	$effect(() => {
		fetchNodeTypes();
	});

	async function fetchNodeTypes() {
		try {
			nodeTypesLoading = true;
			nodeTypesError = null;
			const response = await fetch(`${PUBLIC_API_URL}attributes_node_type/`, {
				credentials: 'include'
			});
			if (!response.ok) {
				throw new Error(`Failed to fetch node types: ${response.status}`);
			}
			nodeTypes = await response.json();

			// Initialize styles for any new types
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
		} catch (error) {
			nodeTypesError = error.message;
			console.error('Error fetching node types:', error);
		} finally {
			nodeTypesLoading = false;
		}
	}

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
		nodeTypes.forEach((nodeType) => {
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
				<h2 class="text-base/7 font-semibold">
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
				<h2 class="text-base/7 font-semibold">
					{m.settings_ui()}
				</h2>

				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_ui_theme()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<span></span>
							<GenericCombobox
								data={themes}
								bind:value={$theme}
								defaultValue={$theme}
								onValueChange={(e) => {
									$theme = e.value;
								}}
								placeholder={$theme}
								zIndex="10"
								classes="w-auto"
							/>
						</dd>
					</div>
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
				<h2 class="text-base/7 font-semibold">{m.settings_map()}</h2>
				<dl class="mt-6 divide-y border-t text-sm/6">
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
				</dl>
			</div>

			<!-- Node Type Styles -->
			<div>
				<div class="flex items-center justify-between">
					<h2 class="text-base/7 font-semibold">{m.settings_node_type_styles()}</h2>
					{#if nodeTypes.length > 0}
						<button
							type="button"
							class="font-semibold text-sm text-primary-500 hover:text-primary-600-400"
							onclick={resetAllNodeTypeStyles}
						>
							{m.common_reset_all()}
						</button>
					{/if}
				</div>

				{#if nodeTypesLoading}
					<div class="mt-6 text-sm">{m.common_loading()}...</div>
				{:else if nodeTypesError}
					<div class="mt-6 text-sm text-error-500">{nodeTypesError}</div>
				{:else if nodeTypes.length === 0}
					<div class="mt-6 text-sm">{m.form_no_data_available()}</div>
				{:else}
					<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each nodeTypes as nodeType}
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

			<!-- Conduit Connection Settings -->
			<div>
				<h2 class="text-base/7 font-semibold">
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
