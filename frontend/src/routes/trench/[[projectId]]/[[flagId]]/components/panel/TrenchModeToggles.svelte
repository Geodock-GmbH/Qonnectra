<script lang="ts">
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import { IconLink, IconRoute } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { routingMode, showLinkedTrenches } from '$lib/stores/store';

	import { getTrenchAssignment } from '../TrenchAssignmentState.svelte';

	const assignment = getTrenchAssignment();

	/** Switches between connecting single trenches and routing; a half-picked route is dropped. */
	function toggleRoutingMode() {
		$routingMode = !$routingMode;
		assignment.resetRoute();
	}

	/** Shows or hides the trenches the selected conduit already runs through. */
	function toggleLinkedTrenches() {
		$showLinkedTrenches = !$showLinkedTrenches;
		assignment.trenchHighlights.setVisible($showLinkedTrenches);
	}
</script>

<div class="grid grid-cols-1 gap-2 sm:gap-3 @min-[36rem]:grid-cols-2">
	<label
		class="flex min-w-0 items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-md bg-surface-100-900 cursor-pointer transition-colors hover:bg-surface-200-800"
		title={m.form_routing_mode()}
	>
		<span class="inline-flex shrink-0">
			<Switch name="routing-mode" checked={$routingMode} onCheckedChange={toggleRoutingMode}>
				<Switch.Control class="scale-90">
					<Switch.Thumb />
				</Switch.Control>
				<Switch.HiddenInput />
			</Switch>
		</span>
		<IconRoute class="size-5 shrink-0 text-surface-900-100 sm:hidden" />
		<span
			class="hidden min-w-0 flex-1 wrap-break-word sm:inline text-sm sm:text-base font-medium leading-tight text-surface-900-100"
			>{m.form_routing_mode()}</span
		>
	</label>

	<label
		class="flex min-w-0 items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-md bg-surface-100-900 cursor-pointer transition-colors hover:bg-surface-200-800"
		title={m.form_show_linked_trenches()}
	>
		<span class="inline-flex shrink-0">
			<Switch
				name="show-linked-trenches"
				checked={$showLinkedTrenches}
				onCheckedChange={toggleLinkedTrenches}
			>
				<Switch.Control class="scale-90">
					<Switch.Thumb />
				</Switch.Control>
				<Switch.HiddenInput />
			</Switch>
		</span>
		<IconLink class="size-5 shrink-0 text-surface-900-100 sm:hidden" />
		<span
			class="hidden min-w-0 flex-1 wrap-break-word sm:inline text-sm sm:text-base font-medium leading-tight text-surface-900-100"
			>{m.form_show_linked_trenches()}</span
		>
	</label>
</div>
