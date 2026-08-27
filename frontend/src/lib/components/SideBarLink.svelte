<script>
	import { page } from '$app/state';
	import { IconEye, IconEyeOff } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { tooltip } from '$lib/utils/tooltip';

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib/config/navLinks').NavLink} link - Navigation entry to render
	 * @property {(isSelected: boolean) => string} anchorClass - Builds the anchor CSS classes
	 * @property {boolean} [iconOnly] - Render only the icon (rail layout)
	 * @property {boolean} [customizing] - Show the hide/show toggle
	 * @property {boolean} [hidden] - Whether this route is currently hidden
	 * @property {(routeId: string) => void} [onToggleHidden] - Called when the hide toggle is clicked
	 */

	/** @type {Props} */
	let {
		link,
		anchorClass,
		iconOnly = false,
		customizing = false,
		hidden = false,
		onToggleHidden
	} = $props();

	const Icon = $derived(link.icon);
	const isSelected = $derived(link.pathMatch(page.url.pathname));
</script>

{#if iconOnly}
	<a
		href={link.href}
		class={anchorClass(isSelected)}
		aria-label={link.label()}
		{@attach tooltip(link.label())}
	>
		<Icon class="size-7 text-surface-700-300" />
	</a>
{:else}
	<div class="flex items-center gap-1 {hidden ? 'opacity-50' : ''}">
		<a
			href={link.href}
			class={anchorClass(isSelected)}
			aria-label={link.label()}
			{@attach tooltip(link.label())}
		>
			<Icon class="size-7 text-surface-700-300" />
			<span>{link.label()}</span>
		</a>
		{#if customizing}
			<button
				type="button"
				class="btn-icon btn-icon-sm hover:preset-tonal shrink-0"
				aria-pressed={hidden}
				aria-label={hidden ? m.action_show_route() : m.action_hide_route()}
				{@attach tooltip(hidden ? m.action_show_route() : m.action_hide_route())}
				onclick={() => onToggleHidden?.(link.id)}
			>
				{#if hidden}
					<IconEyeOff class="size-5 text-surface-700-300" />
				{:else}
					<IconEye class="size-5 text-surface-700-300" />
				{/if}
			</button>
		{/if}
	</div>
{/if}
