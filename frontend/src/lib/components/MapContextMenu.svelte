<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconLine, IconPolygon, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	interface ContextMenuActions {
		measureDistance?: boolean;
		measureArea?: boolean;
	}

	interface Props {
		measureManager?: {
			isMeasuring?: boolean;
			startMeasure: (mode: 'distance' | 'area') => void;
			stopMeasure: () => void;
		};
		actions?: ContextMenuActions;
		children: Snippet;
	}

	let {
		measureManager,
		actions = { measureDistance: true, measureArea: true },
		children
	}: Props = $props();

	function handleSelect(detail: { value: string }) {
		switch (detail.value) {
			case 'measure-distance':
				measureManager?.startMeasure('distance');
				break;
			case 'measure-area':
				measureManager?.startMeasure('area');
				break;
			case 'stop-measuring':
				measureManager?.stopMeasure();
				break;
		}
	}
</script>

<Menu onSelect={handleSelect}>
	<Menu.ContextTrigger class="contents">
		{@render children()}
	</Menu.ContextTrigger>
	<Portal>
		<Menu.Positioner>
			<Menu.Content class="card p-2 shadow-xl space-y-1 min-w-48 z-50">
				{#if measureManager?.isMeasuring}
					<Menu.Item value="stop-measuring">
						<span class="flex items-center gap-2 w-full">
							<IconX size={16} class="shrink-0" />
							<span>{m.action_stop_measuring()}</span>
						</span>
					</Menu.Item>
					<Menu.Separator />
				{/if}
				{#if actions.measureDistance}
					<Menu.Item value="measure-distance">
						<span class="flex items-center gap-2 w-full">
							<IconLine size={16} class="shrink-0" />
							<span>{m.action_measure_distance()}</span>
						</span>
					</Menu.Item>
				{/if}
				{#if actions.measureArea}
					<Menu.Item value="measure-area">
						<span class="flex items-center gap-2 w-full">
							<IconPolygon size={16} class="shrink-0" />
							<span>{m.action_measure_area()}</span>
						</span>
					</Menu.Item>
				{/if}
			</Menu.Content>
		</Menu.Positioner>
	</Portal>
</Menu>
