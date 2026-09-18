<script lang="ts">
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	interface Props {
		checked?: boolean;
		onCheckedChange?: (event: { checked: boolean }) => void;
		partial?: boolean;
		onPartialChange?: (partial: boolean) => void;
	}

	let { checked = false, onCheckedChange, partial = false, onPartialChange }: Props = $props();

	function handleModeChange(event: { checked: boolean }) {
		if (onCheckedChange) {
			onCheckedChange(event);
		}
	}

	function handlePartialChange(event: Event) {
		if (onPartialChange) {
			onPartialChange((event.target as HTMLInputElement).checked);
		}
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<span class="text-sm font-medium">{m.form_auto_connect()}:</span>
		<Switch name="lasso-mode-switch" {checked} onCheckedChange={handleModeChange}>
			<Switch.Control>
				<Switch.Thumb />
			</Switch.Control>
			<Switch.HiddenInput />
		</Switch>
	</div>

	{#if checked}
		<div class="hidden">
			<label class="flex items-center gap-2 text-sm">
				<input
					id="lasso-partial"
					name="lasso_partial"
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
