<script lang="ts">
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import { nextTopZIndex } from '$lib/utils/topLayer';

	interface Props {
		heading?: string;
		message?: string;
		showAcceptButton?: boolean;
		acceptText?: string;
		closeText?: string;
		onAccept?: (() => void) | null;
	}

	let {
		heading,
		message,
		showAcceptButton = false,
		acceptText = m.common_confirm(),
		closeText = m.common_close(),
		onAccept = null
	}: Props = $props();

	let openState = $state(false);

	// Take a fresh top-layer z-index each time the dialog opens so it renders
	// above any floating panel it was triggered from, even a maximized one.
	let zIndex = $state(50);

	export function open() {
		zIndex = nextTopZIndex();
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
	open={openState}
	onOpenChange={(e) => (openState = e.open)}
	closeOnInteractOutside={true}
	closeOnEscape={true}
>
	<Portal>
		<Dialog.Backdrop
			class="fixed inset-0 bg-surface-50-950/50 backdrop-blur-sm"
			style="z-index: {zIndex};"
		/>

		<Dialog.Positioner
			class="fixed inset-0 flex items-center justify-center"
			style="z-index: {zIndex};"
		>
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
