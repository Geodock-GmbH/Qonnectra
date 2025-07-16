<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';

	// Svelte
	import { userStore } from '$lib/stores/auth';
	import LightSwitch from './LightSwitch.svelte';
	import ProjectCombobox from './ProjectCombobox.svelte';

	let { data } = $props();
</script>

<!-- AppBar -->
<div>
	<AppBar background="bg-transparent">
		{#snippet lead()}
			{#if $userStore.isAuthenticated}
				<ProjectCombobox projects={data.projects} projectsError={data.projectsError} />
			{/if}
		{/snippet}
		{#snippet trail()}
			<div class="flex items-center gap-6">
				<p class="text-sm text-surface-700-300">v{data.appVersion}</p>
				<LightSwitch />
			</div>
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
					<button class="btn bg-transparent" aria-label="Login">
						<IconUserCircle class="text-surface-700-300" />
					</button>
				</a>
			{/if}
		{/snippet}
		<span></span>
	</AppBar>
</div>
