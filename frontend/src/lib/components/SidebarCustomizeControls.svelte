<script lang="ts">
	import type { SidebarNavState } from '$lib/classes/SidebarNavState.svelte';
	import { IconAdjustmentsHorizontal, IconRestore } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { tooltip } from '$lib/utils/tooltip';

	interface Props {
		/** Navigation state whose customize mode and preferences the buttons drive */
		nav: SidebarNavState;
	}

	let { nav }: Props = $props();

	/** Label of the customize toggle, naming the action a press performs. */
	const customizeLabel = $derived(
		nav.customizing ? m.action_done_customizing() : m.action_customize_sidebar()
	);
</script>

{#if nav.customizing}
	<button
		type="button"
		class="btn-icon btn-icon-sm hover:preset-tonal self-center"
		aria-label={m.action_reset_sidebar()}
		{@attach tooltip(m.action_reset_sidebar(), { position: 'bottom' })}
		onclick={() => nav.reset()}
	>
		<IconRestore class="size-5 text-surface-700-300" />
	</button>
{/if}
<button
	type="button"
	class={[
		'btn-icon btn-icon-sm hover:preset-tonal self-center',
		nav.customizing && 'preset-filled'
	]}
	aria-pressed={nav.customizing}
	aria-label={customizeLabel}
	{@attach tooltip(customizeLabel, { position: 'bottom' })}
	onclick={() => nav.toggleCustomizing()}
>
	<IconAdjustmentsHorizontal class="size-5 text-surface-700-300" />
</button>
