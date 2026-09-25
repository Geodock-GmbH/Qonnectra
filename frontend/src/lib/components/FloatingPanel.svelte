<script lang="ts">
	import type { FloatingPanelRect } from '$lib/stores/store';
	import type { Snippet } from 'svelte';
	import { get } from 'svelte/store';
	import { Portal, FloatingPanel as SkeletonFloatingPanel } from '@skeletonlabs/skeleton-svelte';
	import {
		IconGripVertical,
		IconMaximize,
		IconMaximizeOff,
		IconMinus,
		IconX
	} from '@tabler/icons-svelte';

	import { floatingPanelRects } from '$lib/stores/store';
	import { nextTopZIndex } from '$lib/utils/topLayer';

	interface Props {
		open?: boolean;
		title?: string;
		width?: number;
		height?: number;
		minWidth?: number;
		minHeight?: number;
		maxWidth?: number;
		maxHeight?: number;
		resizable?: boolean;
		/** Remembers the last position and size across mounts and page reloads under this key. */
		storageKey?: string;
		children?: Snippet;
	}

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
		storageKey,
		children
	}: Props = $props();

	/**
	 * The rect the panel opens at: the one remembered under `storageKey`, else
	 * the default size centred.
	 * @returns The opening rect, inside the window when there is one.
	 */
	function openingRect(): FloatingPanelRect {
		const remembered = storageKey ? get(floatingPanelRects)[storageKey] : undefined;
		if (typeof window === 'undefined') return remembered ?? { x: 100, y: 100, width, height };
		const centred = {
			x: (window.innerWidth - width) / 2,
			y: (window.innerHeight - height) / 2,
			width,
			height
		};
		return fitIntoWindow(remembered ?? centred);
	}

	/**
	 * Shrinks and moves a rect so it lies inside the window, which may be
	 * smaller than the one a remembered rect was saved in.
	 * @param rect - The rect to fit.
	 * @returns The fitted rect.
	 */
	function fitIntoWindow(rect: FloatingPanelRect): FloatingPanelRect {
		const fitWidth = Math.min(rect.width, window.innerWidth);
		const fitHeight = Math.min(rect.height, window.innerHeight);
		return {
			x: Math.min(Math.max(0, rect.x), window.innerWidth - fitWidth),
			y: Math.min(Math.max(0, rect.y), window.innerHeight - fitHeight),
			width: fitWidth,
			height: fitHeight
		};
	}

	const opening = openingRect();
	let size = $state.raw({ width: opening.width, height: opening.height });
	let position = $state.raw({ x: opening.x, y: opening.y });
	let stage: string = 'default';

	/**
	 * Remembers the panel's rect under `storageKey`, if it has one. A maximized
	 * or minimized rect is the stage's, not the user's, so it is not remembered.
	 * @param rect - The panel's current position and size.
	 */
	function rememberRect(rect: FloatingPanelRect) {
		if (!storageKey || stage !== 'default') return;
		const key = storageKey;
		floatingPanelRects.update((rects) => ({ ...rects, [key]: rect }));
	}

	// Draws from the shared top-layer counter so a panel brought to front sits
	// above other panels — and a modal dialog opened afterwards sits above it.
	let zIndex = $state(50);

	/**
	 * Brings this panel to front by taking the next shared top-layer z-index.
	 */
	function bringToFront() {
		zIndex = nextTopZIndex();
	}

	/**
	 * Returns the panel to its opening rect once it closes, however it was
	 * closed, so the next opening starts from the remembered rect rather than
	 * the last stage's.
	 * @returns The teardown that runs when the open panel unmounts.
	 */
	function resetOnClose() {
		return () => {
			const rect = openingRect();
			size = { width: rect.width, height: rect.height };
			position = { x: rect.x, y: rect.y };
			stage = 'default';
		};
	}
</script>

<!-- Mounted only while open, so every opening starts in the default stage. `persistRect` keeps the machine from resetting the rect on close; `resetOnClose` decides it instead. `restoreFocus` is off because the panel has no trigger to refocus, and the machine's deferred refocus would read its props after the panel unmounted. -->
{#if open}
	<SkeletonFloatingPanel
		open={true}
		onOpenChange={(details) => (open = details.open)}
		onStageChange={(details) => (stage = details.stage)}
		{size}
		onSizeChange={(details) => (size = details.size)}
		onSizeChangeEnd={(details) => rememberRect({ ...position, ...details.size })}
		{position}
		onPositionChange={(details) => (position = details.position)}
		onPositionChangeEnd={(details) => rememberRect({ ...details.position, ...size })}
		persistRect={true}
		restoreFocus={false}
		minSize={{ width: minWidth, height: minHeight }}
		maxSize={{ width: maxWidth, height: maxHeight }}
		draggable={true}
		{resizable}
	>
		<Portal>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="floating-panel-wrapper"
				style:--fp-z-index={zIndex}
				onmousedown={bringToFront}
				{@attach resetOnClose}
			>
				<SkeletonFloatingPanel.Positioner>
					<SkeletonFloatingPanel.Content
						class="card bg-surface-100-900 shadow-xl border border-surface-200-800 flex flex-col"
					>
						<!-- Panel Header -->
						<SkeletonFloatingPanel.DragTrigger class="cursor-move">
							<SkeletonFloatingPanel.Header
								class="flex items-center justify-between p-3 border-b border-surface-200-800"
							>
								<SkeletonFloatingPanel.Title class="flex items-center gap-2 text-sm font-semibold">
									<IconGripVertical size={16} class="text-surface-400" />
									{title}
								</SkeletonFloatingPanel.Title>
								<SkeletonFloatingPanel.Control class="flex items-center">
									<SkeletonFloatingPanel.StageTrigger stage="minimized">
										<IconMinus class="size-4" />
									</SkeletonFloatingPanel.StageTrigger>
									<SkeletonFloatingPanel.StageTrigger stage="maximized">
										<IconMaximize class="size-4" />
									</SkeletonFloatingPanel.StageTrigger>
									<SkeletonFloatingPanel.StageTrigger stage="default">
										<IconMaximizeOff class="size-4" />
									</SkeletonFloatingPanel.StageTrigger>
									<SkeletonFloatingPanel.CloseTrigger
										class="p-1 rounded hover:bg-surface-200-800 transition-colors"
									>
										<IconX size={16} />
									</SkeletonFloatingPanel.CloseTrigger>
								</SkeletonFloatingPanel.Control>
							</SkeletonFloatingPanel.Header>
						</SkeletonFloatingPanel.DragTrigger>
						<!-- Panel Body -->
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
			</div>
		</Portal>
	</SkeletonFloatingPanel>
{/if}

<style>
	.floating-panel-wrapper {
		display: contents;
	}
	.floating-panel-wrapper :global([data-part='positioner']) {
		z-index: var(--fp-z-index, 50) !important;
	}
</style>
