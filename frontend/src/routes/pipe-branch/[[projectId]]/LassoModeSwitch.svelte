<script>
	// Skeleton
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Icons
	import { IconLasso, IconPointer } from '@tabler/icons-svelte';

	let { checked = false, onCheckedChange, partial = false, onPartialChange } = $props();

	function handleModeChange(event) {
		if (onCheckedChange) {
			onCheckedChange(event);
		}
	}

	function handlePartialChange(event) {
		if (onPartialChange) {
			onPartialChange(event.target.checked);
		}
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Lasso Mode Switch -->
	<div class="flex items-center gap-2">
		<span class="text-sm font-medium">{m.form_lasso_mode()}:</span>
		<Switch
			name="lasso-mode-switch"
			controlActive="bg-surface-200"
			{checked}
			onCheckedChange={handleModeChange}
		>
			{#snippet activeChild()}
				<IconLasso size="18" />
			{/snippet}
			{#snippet inactiveChild()}
				<IconPointer size="18" />
			{/snippet}
		</Switch>
	</div>

	<!-- Partial Selection Checkbox (only shown when lasso mode is active) -->
	{#if checked}
		<div class="hidden">
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={partial}
					onchange={handlePartialChange}
					class="xy-theme__checkbox"
				/>
				{m.form_partial_selection()}
			</label>
		</div>
	{/if}
</div>

<style>
	.xy-theme__checkbox {
		appearance: none;
		width: 16px;
		height: 16px;
		border: 2px solid var(--color-surface-400);
		border-radius: 3px;
		background: var(--color-surface-50);
		cursor: pointer;
		position: relative;
	}

	.xy-theme__checkbox:checked {
		background: var(--color-primary-500);
		border-color: var(--color-primary-500);
	}

	.xy-theme__checkbox:checked::after {
		content: '✓';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: white;
		font-size: 12px;
		font-weight: bold;
	}
</style>
