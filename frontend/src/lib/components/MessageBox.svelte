<script>
	// Skeleton
	import { Modal } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let {
		heading,
		message,
		showAcceptButton = false,
		acceptText = m.accept ? m.accept() : 'Accept',
		closeText = m.close ? m.close() : 'Close',
		onAccept = null
	} = $props();

	let openState = $state(false);

	export function open() {
		openState = true;
	}

	export function close() {
		openState = false;
	}

	function handleAccept() {
		if (onAccept) {
			onAccept();
		}
		close();
	}
</script>

<!-- MessageBox -->
<Modal
	open={openState}
	onOpenChange={(e) => (openState = e.open)}
	triggerBase="btn preset-tonal"
	contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
	backdropClasses="backdrop-blur-sm"
	onPointerDownOutside={() => (openState = false)}
	onInteractOutside={() => (openState = false)}
	onEscapeKeyDown={() => (openState = false)}
>
	{#snippet content()}
		<header>
			<h3 class="text-lg font-bold">{heading}</h3>
		</header>
		<article>
			<p>{message}</p>
		</article>
		<footer class="flex gap-2 justify-end">
			<button class="btn preset-filled-surface-500" onclick={close}>
				{closeText}
			</button>
			{#if showAcceptButton}
				<button class="btn preset-filled-primary-500" onclick={handleAccept}>
					{acceptText}
				</button>
			{/if}
		</footer>
	{/snippet}
</Modal>
