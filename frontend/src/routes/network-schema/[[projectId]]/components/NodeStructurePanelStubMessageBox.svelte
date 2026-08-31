<script lang="ts">
	let {
		heading = '',
		message = '',
		acceptText = '',
		onAccept
	}: {
		heading?: string;
		message?: string;
		acceptText?: string;
		onAccept?: () => void;
	} = $props();

	let isOpen = $state(false);

	export function open() {
		isOpen = true;
	}

	export function close() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<div data-testid="message-box" role="dialog">
		<div data-testid="message-box-heading">{heading}</div>
		<div data-testid="message-box-message">{message}</div>
		<button
			data-testid="message-box-accept"
			onclick={() => {
				onAccept?.();
				isOpen = false;
			}}
		>
			{acceptText}
		</button>
	</div>
{/if}
