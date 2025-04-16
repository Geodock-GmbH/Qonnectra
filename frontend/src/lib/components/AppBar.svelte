<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
	import { goto } from '$app/navigation';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';
	import { userStore, updateUserStore } from '$lib/stores/auth';

	async function handleLogout() {
		try {
			const response = await fetch(`${PUBLIC_API_URL}auth/logout/`, {
				method: 'POST',
				credentials: 'include'
			});

			if (response.ok) {
				updateUserStore(null);
				await goto('/login');
			} else {
				console.error('Logout failed:', response.status);
			}
		} catch (error) {
			console.error('Logout error:', error);
		}
	}
</script>

<div>
	<AppBar>
		{#snippet trail()}
			{#if $userStore.isAuthenticated}
				<div class="flex items-center gap-2">
					<button class="btn bg-transparent" onclick={handleLogout}>
						<IconLogout class="h-6 w-6" />
					</button>
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
