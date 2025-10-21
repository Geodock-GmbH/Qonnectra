<script>
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';

	import { userStore } from '$lib/stores/auth';

	import LightSwitch from './LightSwitch.svelte';
	import LocaleSwitcher from './LocaleSwitcher.svelte';
	import ProjectCombobox from './ProjectCombobox.svelte';

	let { data } = $props();
</script>

<!-- AppBar -->
<div>
	<AppBar class="bg-transparent">
		<AppBar.Toolbar class="grid-cols-[auto_1fr_auto]">
			<AppBar.Lead>
				{#if $userStore.isAuthenticated}
					<div class="w-full max-w-full min-w-0 px-2 sm:px-0">
						<ProjectCombobox projects={data.projects} projectsError={data.projectsError} />
					</div>
				{/if}
			</AppBar.Lead>
			<AppBar.Headline>
				<!-- Optional headline content can go here -->
			</AppBar.Headline>
			<AppBar.Trail>
				<div class="flex items-center gap-2 sm:gap-6 flex-shrink-0">
					<p class="text-xs sm:text-sm text-surface-700-300 hidden sm:block">v{data.appVersion}</p>
					<LocaleSwitcher />
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
			</AppBar.Trail>
		</AppBar.Toolbar>
	</AppBar>
</div>
