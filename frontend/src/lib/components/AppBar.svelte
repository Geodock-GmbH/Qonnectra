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
				<div class="w-full max-w-full min-w-0 px-2 sm:px-0">
					<ProjectCombobox projects={data.projects} projectsError={data.projectsError} />
				</div>
			{/if}
		{/snippet}
		{#snippet trail()}
			<div class="flex items-center gap-2 sm:gap-6 flex-shrink-0">
				<p class="text-xs sm:text-sm text-surface-700-300 hidden sm:block">v{data.appVersion}</p>
				<LightSwitch />
			</div>
			{#if $userStore.isAuthenticated}
				<div class="flex items-center flex-shrink-0">
					<form method="POST" action="/logout">
						<button type="submit" class="btn bg-transparent p-2 sm:p-1 touch-manipulation">
							<IconLogout class="text-surface-700-300 " />
						</button>
					</form>
				</div>
			{:else}
				<a href="/login">
					<button class="btn bg-transparent p-2 sm:p-1 touch-manipulation" aria-label="Login">
						<IconUserCircle class="text-surface-700-300 " />
					</button>
				</a>
			{/if}
		{/snippet}
		<span></span>
	</AppBar>
</div>
