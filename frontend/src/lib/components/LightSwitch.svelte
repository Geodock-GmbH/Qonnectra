<script>
	import { onMount } from 'svelte';
	import { IconMoon, IconSun } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { lightSwitchMode } from '$lib/stores/store';
	import { tooltip } from '$lib/utils/tooltip.js';

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
	aria-label={m.tooltip_toggle_theme()}
	{@attach tooltip(m.tooltip_toggle_theme(), { position: 'bottom' })}
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
