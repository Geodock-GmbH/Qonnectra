<script lang="ts">
	import type { Snippet } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	let {
		children,
		pending: pendingContent,
		class: className = ''
	}: {
		children: Snippet;
		/** Replaces the default placeholder while the first load is in flight. */
		pending?: Snippet;
		/** Applied to the default placeholder and the error card (e.g. grid spans). */
		class?: string;
	} = $props();
</script>

{#snippet defaultPending()}
	<div class={['card p-4 sm:p-6 animate-pulse space-y-3', className]} role="status">
		<div class="h-4 w-1/3 rounded bg-surface-200-800"></div>
		<div class="h-4 w-2/3 rounded bg-surface-200-800"></div>
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

{#snippet failed(error: unknown, reset: () => void)}
	<div
		class={['card preset-filled-error-500 p-4 flex items-center justify-between gap-4', className]}
		role="alert"
	>
		<p>{remoteErrorMessage(error) ?? m.message_error_loading_data()}</p>
		<button type="button" class="btn preset-outlined shrink-0" onclick={reset}>
			{m.common_retry()}
		</button>
	</div>
{/snippet}

<svelte:boundary pending={pendingContent ?? defaultPending} {failed}>
	{@render children()}
</svelte:boundary>
