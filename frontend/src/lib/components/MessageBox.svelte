<script>
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		heading,
		message,
		showAcceptButton = false,
		acceptText = m.common_confirm(),
		closeText = m.common_close(),
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
<Dialog
	bind:open={openState}
	onOpenChange={(e) => (openState = e.open)}
	closeOnInteractOutside={true}
	closeOnEscape={true}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 backdrop-blur-sm" />

		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
			<Dialog.Content
				class="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm w-full"
			>
				<Dialog.Title>
					<h3 class="text-lg font-bold">{heading}</h3>
				</Dialog.Title>

				<Dialog.Description>
					<p>{message}</p>
				</Dialog.Description>

				<footer class="flex gap-2 justify-end">
					<button class="btn preset-filled" onclick={close}>
						{closeText}
					</button>
					{#if showAcceptButton}
						<button class="btn preset-filled-error-500" onclick={handleAccept}>
							{acceptText}
						</button>
					{/if}
				</footer>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
