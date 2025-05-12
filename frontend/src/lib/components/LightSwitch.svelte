<script>
	// Skeleton
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconSun, IconMoon } from '@tabler/icons-svelte';

	// Svelte
	import { writable } from 'svelte/store';
	import { lightSwitchMode } from '$lib/stores/store';

	// Local
	let checked = $state(false);

	$effect(() => {
		const mode = localStorage.getItem('mode') || 'light';
		checked = mode === 'dark';
	});

	const onCheckedChange = (event) => {
		const mode = event.checked ? 'dark' : 'light';
		document.documentElement.setAttribute('data-mode', mode);
		localStorage.setItem('mode', mode);
		lightSwitchMode.set(mode);
		checked = event.checked;
	};
</script>

<svelte:head>
	<script>
		const mode = localStorage.getItem('mode') || 'light';
		document.documentElement.setAttribute('data-mode', mode);
	</script>
</svelte:head>

<Switch name="light-switch" controlActive="bg-surface-200" {checked} {onCheckedChange}>
	{#snippet activeChild()}
		<IconMoon size="18" />
	{/snippet}
	{#snippet inactiveChild()}
		<IconSun size="18" />
	{/snippet}
</Switch>
