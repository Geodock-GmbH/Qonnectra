<script>
	// Skeleton
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import { IconMoon, IconSun } from '@tabler/icons-svelte';

	// Svelte
	import { lightSwitchMode } from '$lib/stores/store';

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

<!-- Head -->
<svelte:head>
	<script>
		const mode = localStorage.getItem('mode') || 'light';
		document.documentElement.setAttribute('data-mode', mode);
	</script>
</svelte:head>

<!-- LightSwitch -->
<Switch name="light-switch" controlActive="bg-surface-200" {checked} {onCheckedChange}>
	{#snippet activeChild()}
		<IconMoon size="18" />
	{/snippet}
	{#snippet inactiveChild()}
		<IconSun size="18" />
	{/snippet}
</Switch>
