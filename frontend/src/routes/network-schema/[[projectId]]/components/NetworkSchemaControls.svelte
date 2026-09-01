<script lang="ts">
	import { ControlButton, Controls } from '@xyflow/svelte';
	import { IconLock, IconLockOpen } from '@tabler/icons-svelte';

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
			class="svelte-flow__controls-interactive"
			onclick={() => (schemaState.locked = !schemaState.locked)}
			title={lockLabel}
			aria-label={lockLabel}
			aria-pressed={schemaState.locked}
		>
			{#if schemaState.locked}
				<IconLock size={14} />
			{:else}
				<IconLockOpen size={14} />
			{/if}
		</ControlButton>
	{/snippet}
</Controls>
