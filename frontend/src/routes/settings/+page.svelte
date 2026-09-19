<script lang="ts">
	import { Slider, Switch } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { DEFAULT_SELECTED_COLOR, DEFAULT_TRENCH_COLOR } from '$lib/map/styles';
	import { userStore } from '$lib/stores/auth';
	import {
		cableEdgeColorMode,
		routingTolerance,
		sidebarExpanded,
		trenchColor,
		trenchColorSelected,
		trenchStyleMode
	} from '$lib/stores/store';

	import AddressStyleSection from './components/AddressStyleSection.svelte';
	import ColorStyleSection from './components/ColorStyleSection.svelte';
	import NodeTypeStyles from './components/NodeTypeStyles.svelte';
	import SettingsSync from './components/SettingsSync.svelte';

	const ROUTING_TOLERANCE_MARKERS = Array.from({ length: 10 }, (_, i) => i + 1);
</script>

<svelte:head>
	<title>{m.nav_settings()}</title>
</svelte:head>

<div class="mx-auto max-w-7xl pt-16 lg:flex lg:gap-x-16 lg:px-8">
	<h1 class="sr-only">User Settings</h1>

	<main class="px-4 py-16 sm:px-6 lg:flex-auto lg:px-0 lg:py-20">
		<div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-none space-y-16 sm:space-y-20 pb-20">
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
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_sync_label()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<p>{m.settings_sync_description()}</p>
							<SettingsSync />
						</dd>
					</div>
				</dl>
			</div>

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

			<div>
				<h2 class="text-base/7 font-semibold text-primary-900-100">{m.settings_map()}</h2>
				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_map_selected_feature_color()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<input type="color" name="trench-color-selected" bind:value={$trenchColorSelected} />
							<button
								name="reset-trench-color-selected"
								type="button"
								class="font-semibold text-primary-500 hover:text-primary-600-400"
								onclick={() => {
									$trenchColorSelected = DEFAULT_SELECTED_COLOR;
								}}
							>
								{m.common_reset()}
							</button>
						</dd>
					</div>
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_map_trench_color()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<input type="color" name="trench-color" bind:value={$trenchColor} />
							<button
								name="reset-trench-color"
								type="button"
								class="font-semibold text-primary-500 hover:text-primary-600-400"
								onclick={() => {
									$trenchColor = DEFAULT_TRENCH_COLOR;
								}}
							>
								{m.common_reset()}
							</button>
						</dd>
					</div>
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

			{#if $trenchStyleMode === 'surface'}
				<QueryBoundary>
					<ColorStyleSection kind="surface" />
				</QueryBoundary>
			{:else if $trenchStyleMode === 'construction_type'}
				<QueryBoundary>
					<ColorStyleSection kind="construction_type" />
				</QueryBoundary>
			{/if}

			<QueryBoundary>
				<NodeTypeStyles />
			</QueryBoundary>

			<AddressStyleSection />

			<QueryBoundary>
				<ColorStyleSection kind="area_type" />
			</QueryBoundary>

			<div>
				<h2 class="text-base/7 font-semibold text-primary-900-100">
					{m.settings_cable_edge_color()}
				</h2>
				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_cable_edge_color_mode()}
						</dt>
						<dd class="mt-1 flex flex-col gap-3 sm:mt-0 sm:flex-auto">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="cable-edge-color-mode"
									value="default"
									checked={$cableEdgeColorMode === 'default'}
									onchange={() => ($cableEdgeColorMode = 'default')}
									class="radio"
								/>
								<div class="flex items-center gap-2">
									<span class="w-4 h-1 rounded" style="background-color: #22c55e;"></span>
									<span class="text-sm">{m.settings_cable_edge_color_default()}</span>
								</div>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="cable-edge-color-mode"
									value="linked"
									checked={$cableEdgeColorMode === 'linked'}
									onchange={() => ($cableEdgeColorMode = 'linked')}
									class="radio"
								/>
								<div class="flex items-center gap-2">
									<span class="w-4 h-1 rounded" style="background-color: #22c55e;"></span>
									<span>/</span>
									<span class="w-4 h-1 rounded" style="background-color: #3b82f6;"></span>
									<span class="text-sm">{m.settings_cable_edge_color_linked()}</span>
								</div>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="cable-edge-color-mode"
									value="micropipe"
									checked={$cableEdgeColorMode === 'micropipe'}
									onchange={() => ($cableEdgeColorMode = 'micropipe')}
									class="radio"
								/>
								<div class="flex items-center gap-2">
									<span
										class="w-4 h-1 rounded bg-linear-to-r from-red-500 via-yellow-500 to-blue-500"
									></span>
									<span class="text-sm">{m.settings_cable_edge_color_micropipe()}</span>
								</div>
							</label>
						</dd>
					</div>
				</dl>
			</div>

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
									{#each ROUTING_TOLERANCE_MARKERS as marker (marker)}
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
