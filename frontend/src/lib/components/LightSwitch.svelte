<script>
	// Skeleton
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	// Icons
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

<Switch name="light-switch" {checked} {onCheckedChange}>
	<Switch.Control>
		<Switch.Thumb />
	</Switch.Control>
	<Switch.HiddenInput />
</Switch>
