<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';
	import { userStore } from '$lib/stores/auth';
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
					<Avatar name={$userStore.username || 'User'} size="size-8" font="font-bold" />
				</div>
			{:else}
				<a href="/login">
					<button class="btn bg-transparent">
						<IconUserCircle />
					</button>
				</a>
			{/if}
		{/snippet}
		<span class="font-bold">{$userStore.username}</span>
	</AppBar>
</div>
