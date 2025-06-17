<script>
	// Skeleton
	import { AppBar, Combobox } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Icons
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';

	// Svelte
	import { userStore } from '$lib/stores/auth';
	import LightSwitch from './LightSwitch.svelte';
	import ProjectCombobox from './ProjectCombobox.svelte';
</script>

<div>
	<AppBar background="bg-transparent">
		{#snippet lead()}
			{#if $userStore.isAuthenticated}
				<ProjectCombobox />
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
