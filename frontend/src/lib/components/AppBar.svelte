<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';

	// Svelte
	import { userStore } from '$lib/stores/auth';
	import { enhance } from '$app/forms';
</script>

<div>
	<AppBar>
		{#snippet trail()}
			{#if $userStore.isAuthenticated}
				<div class="flex items-center gap-2">
					<form method="POST" action="/logout" use:enhance>
						<button type="submit" class="btn bg-transparent p-0">
							<IconLogout class="h-6 w-6" />
						</button>
					</form>
				</div>
			{:else}
				<a href="/login">
					<button class="btn bg-transparent">
						<IconUserCircle />
					</button>
				</a>
			{/if}
		{/snippet}
		<!-- TODO: Remove this later -->
		<span class="font-bold">{$userStore.username}</span>
	</AppBar>
</div>
