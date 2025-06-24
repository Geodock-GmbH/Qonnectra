<script>
	// Skeleton
	import { Toaster, createToaster, Switch, Slider } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { userStore } from '$lib/stores/auth';
	import {
		sidebarExpanded,
		defaultProject,
		trenchColor,
		trenchColorSelected,
		routingMode,
		routingTolerance
	} from '$lib/stores/store';

	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// Stop page from scrolling
	$effect(() => {
		document.body.style.overflow = 'hidden';
	});

	let routingToleranceMarkers = $derived(Array.from({ length: 10 }, (_, i) => i + 1));
</script>

<Toaster {toaster}></Toaster>

<div class="mx-auto max-w-7xl pt-16 lg:flex lg:gap-x-16 lg:px-8 overflow-y-auto">
	<h1 class="sr-only">User Settings</h1>

	<main class="px-4 py-16 sm:px-6 lg:flex-auto lg:px-0 lg:py-20">
		<div class="mx-auto max-w-2xl lg:mx-0 lg:max-w-none space-y-16 sm:space-y-20">
			<!-- User Settings -->
			<div>
				<h2 class="text-base/7 font-semibold">
					{m.settings_user()}
				</h2>
				<p class="mt-1 text-sm/6">
					{m.settings_user_description()}
				</p>

				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_user_username()}
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
				<p class="mt-1 text-sm/6">
					{m.settings_ui_description()}
				</p>

				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_ui_default_project()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<span>{globalThis.$defaultProject}</span>
							<button
								type="button"
								class="font-semibold text-primary-500 hover:text-primary-600-400"
							>
								Update
							</button>
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
							/>
						</dd>
					</div>
				</dl>
			</div>

			<!-- TODO: Add Map Settings -->
			<div>
				<h2 class="text-base/7 font-semibold">Map</h2>
				<p class="mt-1 text-sm/6">
					{m.settings_map_description()}
				</p>

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
							{m.settings_map_selected_trench_color()}
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
			<div>
				<h2 class="text-base/7 font-semibold">
					{m.settings_trench()}
				</h2>
				<p class="mt-1 text-sm/6">
					{m.settings_trench_description()}
				</p>

				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.settings_map_routing_mode()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							{#if $routingMode}
								<p>{m.settings_map_routing_mode_enabled()}</p>
							{:else}
								<p>{m.settings_map_routing_mode_disabled()}</p>
							{/if}
							<Switch
								name="routing-mode"
								checked={$routingMode}
								onCheckedChange={() => {
									$routingMode = !$routingMode;
								}}
							/>
						</dd>
					</div>
				</dl>
				<dl class="mt-6 divide-y border-t text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium sm:w-64 sm:flex-none sm:pr-6">
							{m.routing_tolerance()}
						</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<p>{m.routing_tolerance_description()}</p>
							<Slider
								bind:value={$routingTolerance}
								onValueChange={(e) => ($routingTolerance = e.value)}
								markers={routingToleranceMarkers}
								max={10}
								min={1}
								meterBg="bg-primary-500"
								thumbRingColor="ring-primary-500"
							/>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</main>
</div>
