<script>
	import { onMount } from 'svelte';
	import { IconMoon, IconSun } from '@tabler/icons-svelte';

	import { lightSwitchMode } from '$lib/stores/store';

	let isDark = $state(false);

	onMount(() => {
		const savedMode = localStorage.getItem('mode') || 'light';
		isDark = savedMode === 'dark';
		document.documentElement.setAttribute('data-mode', savedMode);
	});

	function toggleMode() {
		isDark = !isDark;
		const newMode = isDark ? 'dark' : 'light';

		document.documentElement.setAttribute('data-mode', newMode);
		localStorage.setItem('mode', newMode);
		lightSwitchMode.set(newMode);
	}
</script>

<svelte:head>
	<script>
		(function () {
			const savedMode = localStorage.getItem('mode') || 'light';
			document.documentElement.setAttribute('data-mode', savedMode);
		})();
	</script>
</svelte:head>

<button
	type="button"
	class="btn-icon hover:preset-tonal"
	title="Toggle Light/Dark Mode"
	onclick={toggleMode}
	aria-checked={isDark}
	role="switch"
>
	{#if isDark}
		<IconSun class="size-5" />
	{:else}
		<IconMoon class="size-5" />
	{/if}
</button>
