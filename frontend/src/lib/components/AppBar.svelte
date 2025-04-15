<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
	import { getAuthContext } from '$lib/auth.Context';
	import { goto } from '$app/navigation';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { IconLogout, IconUserCircle } from '@tabler/icons-svelte';

	async function handleLogout() {
		try {
			const response = await fetch(`${PUBLIC_API_URL}/api/v1/auth/logout/`, {
				method: 'POST',
				credentials: 'include'
			});

			if (response.ok) {
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
	{#key getAuthContext().isAuthenticated}
		<AppBar>
			{#snippet trail()}
				{#if getAuthContext().isAuthenticated}
					<div class="flex items-center gap-2">
						<button class="btn bg-transparent" on:click={handleLogout}>
							<IconLogout class="h-6 w-6" />
						</button>
						<Avatar name={getAuthContext().username || 'User'} size="size-8" font="font-bold" />
					</div>
				{:else}
					<a href="/login">
						<button class="btn bg-transparent">
							<IconUserCircle />
						</button>
					</a>
				{/if}
			{/snippet}
			<span class="font-bold">Krit-GIS</span>
		</AppBar>
	{/key}
</div>
