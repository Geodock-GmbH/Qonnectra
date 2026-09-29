<script lang="ts">
	import { ControlButton, Controls } from '@xyflow/svelte';
	import { IconLockFilled, IconLockOpen } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getSchemaState } from '$lib/context/networkSchemaContext';

	const schemaState = getSchemaState();

	let lockLabel = $derived(
		schemaState.locked ? m.tooltip_unlock_canvas() : m.tooltip_lock_canvas()
	);
</script>

<Controls showLock={false}>
	{#snippet after()}
		<ControlButton
			class="svelte-flow__controls-interactive lock-control"
			onclick={() => {
				const next = !schemaState.locked;
				schemaState.locked = next;
				if (next) schemaState.exitEditMode();
			}}
			title={lockLabel}
			aria-label={lockLabel}
			aria-pressed={schemaState.locked}
		>
			{#if schemaState.locked}
				<IconLockFilled />
			{:else}
				<IconLockOpen />
			{/if}
		</ControlButton>
	{/snippet}
</Controls>

<style>
	:global(.svelte-flow__controls-button.lock-control svg) {
		max-width: 15px;
		max-height: 15px;
	}
</style>
