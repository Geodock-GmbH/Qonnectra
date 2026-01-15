<script>
	import { Portal, FloatingPanel as SkeletonFloatingPanel } from '@skeletonlabs/skeleton-svelte';
	import { IconGripVertical, IconX } from '@tabler/icons-svelte';

	let {
		open = $bindable(false),
		title = '',
		width = 400,
		height = 300,
		minWidth = 300,
		minHeight = 200,
		maxWidth = 900,
		maxHeight = 600,
		resizable = true,
		children
	} = $props();

	let size = $state({ width, height });

	/**
	 * Handles the open change event.
	 * @param {Object} details - The details of the open change event.
	 * @returns {void}
	 */
	function handleOpenChange(details) {
		open = details.open;
	}

	/**
	 * Handles the size change event.
	 * @param {Object} details - The details of the size change event.
	 * @returns {void}
	 */
	function handleSizeChange(details) {
		size = details.size;
	}

	/**
	 * Gets the center position of the floating panel.
	 * @returns {Object} The center position of the floating panel.
	 */
	function getCenterPosition() {
		if (typeof window === 'undefined') return { x: 100, y: 100 };
		return {
			x: Math.max(0, (window.innerWidth - width) / 2),
			y: Math.max(0, (window.innerHeight - height) / 2)
		};
	}

	const defaultPosition = getCenterPosition();
</script>

<SkeletonFloatingPanel
	{open}
	onOpenChange={handleOpenChange}
	{size}
	onSizeChange={handleSizeChange}
	minSize={{ width: minWidth, height: minHeight }}
	maxSize={{ width: maxWidth, height: maxHeight }}
	draggable={true}
	{resizable}
	{defaultPosition}
>
	<Portal>
		<SkeletonFloatingPanel.Positioner class="z-50">
			<SkeletonFloatingPanel.Content
				class="card bg-surface-100-900 shadow-xl border border-surface-200-800 flex flex-col"
			>
				<SkeletonFloatingPanel.DragTrigger class="cursor-move">
					<SkeletonFloatingPanel.Header
						class="flex items-center justify-between p-3 border-b border-surface-200-800"
					>
						<SkeletonFloatingPanel.Title class="flex items-center gap-2 text-sm font-semibold">
							<IconGripVertical size={16} class="text-surface-400" />
							{title}
						</SkeletonFloatingPanel.Title>
						<SkeletonFloatingPanel.Control class="flex items-center">
							<SkeletonFloatingPanel.CloseTrigger
								class="p-1 rounded hover:bg-surface-200-800 transition-colors"
							>
								<IconX size={16} />
							</SkeletonFloatingPanel.CloseTrigger>
						</SkeletonFloatingPanel.Control>
					</SkeletonFloatingPanel.Header>
				</SkeletonFloatingPanel.DragTrigger>
				<SkeletonFloatingPanel.Body class="flex-1 overflow-auto p-4">
					{@render children?.()}
				</SkeletonFloatingPanel.Body>
				{#if resizable}
					<SkeletonFloatingPanel.ResizeTrigger
						axis="se"
						class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
					/>
				{/if}
			</SkeletonFloatingPanel.Content>
		</SkeletonFloatingPanel.Positioner>
	</Portal>
</SkeletonFloatingPanel>
