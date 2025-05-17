<script>
	// Skeleton
	import { AppBar, Combobox } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Icons
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';

	// Svelte
	import { userStore } from '$lib/stores/auth';
	import { enhance } from '$app/forms';
	import LightSwitch from './LightSwitch.svelte';
	import AddProjectDrawer from './AddProjectDrawer.svelte';

	const comboboxData = [
		{ label: 'Placeholder 1', value: 'US' },
		{ label: 'Placeholder 2', value: 'CA' },
		{ label: 'Placeholder 3', value: 'AU' }
	];
	let selectedProject = 'Placeholder 1';

	let isAddProjectDrawerOpen = false;
</script>

<div>
	<AppBar background="bg-transparent">
		{#snippet lead()}
			<!-- TODO: Replace with Combobox component to change projects -->
			{#if $userStore.isAuthenticated}
				<Combobox
					data={comboboxData}
					onValueChange={(e) => (selectedProject = e.value)}
					placeholder={m.project()}
					classes="z-10"
				></Combobox>
				<AddProjectDrawer
					open={isAddProjectDrawerOpen}
					onOpenChange={(e) => (isAddProjectDrawerOpen = e.open)}
				/>
			{/if}
		{/snippet}
		{#snippet trail()}
			<!-- Light Switch cant be in the settings page because settings are behind a login -->
			<LightSwitch />
			{#if $userStore.isAuthenticated}
				<div class="flex items-center">
					<form method="POST" action="/logout">
						<button type="submit" class="btn bg-transparent">
							<IconLogout class="text-surface-700-300" />
						</button>
					</form>
				</div>
			{:else}
				<a href="/login">
					<button class="btn bg-transparent">
						<IconUserCircle class="text-surface-700-300" />
					</button>
				</a>
			{/if}
		{/snippet}
		<span></span>
	</AppBar>
</div>
