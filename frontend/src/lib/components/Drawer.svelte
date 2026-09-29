<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { get } from 'svelte/store';
	import { fade, fly } from 'svelte/transition';

	import { m } from '$lib/paraglide/messages';

	import { PanelResizeManager } from '$lib/classes/PanelResizeManager.svelte.js';
	import { drawerSnap, drawerWidth } from '$lib/stores/store';
	import { tooltip } from '$lib/utils/tooltip';

	interface Props {
		/** Whether the drawer is shown. The URL decides; the drawer only reports a close. */
		open: boolean;
		/** Header text; empty shows a generic label until the content knows its entity. */
		title?: string;
		/** Called when the user closes the drawer: X, Escape, backdrop or a dismiss drag. */
		onclose: () => void;
		children?: Snippet;
		class?: string;
	}

	let { open, title = '', onclose, children = undefined, class: className = '' }: Props = $props();

	const MIN_WIDTH = 200;
	const MAX_WIDTH_RATIO = 0.8;

	let drawerElement = $state<HTMLDivElement | undefined>();

	const resizer = new PanelResizeManager({
		defaultWidth: get(drawerWidth),
		minWidth: MIN_WIDTH,
		maxWidthRatio: MAX_WIDTH_RATIO,
		side: 'right',
		onResize: (width) => setWidth(width)
	});

	let isMobile = $derived((innerWidth.current ?? 0) < 768);

	/**
	 * Persists the drawer width, clamped to the viewport, and keeps the
	 * resizer's starting point in step with it.
	 * @param width - The requested width in pixels.
	 */
	function setWidth(width: number) {
		const maxWidth = Math.floor(window.innerWidth * MAX_WIDTH_RATIO);
		const clamped = Math.max(MIN_WIDTH, Math.min(width, maxWidth));
		drawerWidth.set(clamped);
		resizer.width = clamped;
	}

	/** Shrinks the desktop drawer when the viewport no longer fits it. */
	function handleWindowResize() {
		if (isMobile) return;
		const maxWidth = Math.floor(window.innerWidth * MAX_WIDTH_RATIO);
		if ($drawerWidth > maxWidth) setWidth(maxWidth);
	}

	/**
	 * Closes the drawer on Escape.
	 * @param event - The keyboard event.
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) onclose();
	}

	// --- Mobile bottom sheet state ---
	let isDraggingSheet = $state(false);
	let dragHeight = $state(0);
	let sheetStartY = $state(0);
	let sheetPointerId = $state<number | null>(null);
	let dragHandleElement = $state<HTMLDivElement | undefined>();

	const SNAP_HALF = 50;
	const SNAP_FULL = 95;
	const SNAP_THRESHOLD = 0.25;

	/**
	 * Height in pixels for a given snap vh value. Reads the reactive window
	 * size rather than `window` itself, because this runs during SSR too,
	 * where the mobile sheet is rendered before any viewport is known.
	 */
	function snapToPixels(snapVh: number): number {
		return (snapVh / 100) * (innerHeight.current ?? 0);
	}

	/** Current snap height in pixels */
	let snapHeight = $derived(snapToPixels($drawerSnap === 'full' ? SNAP_FULL : SNAP_HALF));

	/** The height to render: during drag use live value, otherwise use snap */
	let sheetHeight = $derived(isDraggingSheet ? dragHeight : snapHeight);

	/**
	 * Initiates the mobile sheet drag
	 * @param event
	 */
	function handleSheetDragStart(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;

		isDraggingSheet = true;
		sheetPointerId = event.pointerId;
		sheetStartY = event.clientY;
		dragHeight = snapHeight;

		event.preventDefault();
		dragHandleElement?.setPointerCapture?.(event.pointerId);
		document.body.style.userSelect = 'none';
	}

	/**
	 * Handles pointer movement during sheet drag.
	 * Directly adjusts height so the sheet grows/shrinks under the finger.
	 * @param event
	 */
	function handleSheetDragMove(event: PointerEvent) {
		if (!isDraggingSheet) return;
		if (sheetPointerId !== null && event.pointerId !== sheetPointerId) return;

		const deltaY = sheetStartY - event.clientY;
		const minHeight = 0;
		const maxHeight = snapToPixels(SNAP_FULL);
		dragHeight = Math.max(minHeight, Math.min(snapHeight + deltaY, maxHeight));
	}

	/**
	 * Completes the sheet drag and snaps to appropriate position
	 * @param event
	 */
	function handleSheetDragEnd(event?: PointerEvent) {
		if (!isDraggingSheet) return;

		if (event && sheetPointerId !== null && event.pointerId !== sheetPointerId) return;

		const halfPx = snapToPixels(SNAP_HALF);
		const fullPx = snapToPixels(SNAP_FULL);
		const midpoint = (halfPx + fullPx) / 2;
		const dismissThreshold = halfPx * (1 - SNAP_THRESHOLD);

		if (dragHeight < dismissThreshold) {
			onclose();
		} else if (dragHeight < midpoint) {
			$drawerSnap = 'half';
		} else {
			$drawerSnap = 'full';
		}

		const pointerId = sheetPointerId;
		isDraggingSheet = false;
		sheetPointerId = null;

		if (event && pointerId !== null) {
			try {
				dragHandleElement?.releasePointerCapture?.(pointerId);
			} catch {
				// ignore if capture is already released
			}
		}
		document.body.style.userSelect = '';
	}

	onMount(() => resizer.listen());
</script>

<svelte:window onkeydown={handleKeydown} onresize={handleWindowResize} />

{#if open}
	{#if isMobile}
		<!-- Mobile: Bottom Sheet -->
		<!-- Backdrop -->
		<button
			class="fixed inset-0 bg-black/40 z-40"
			transition:fade={{ duration: 200 }}
			onclick={onclose}
			aria-label={m.tooltip_close_drawer()}
		></button>

		<!-- Sheet -->
		<div
			bind:this={drawerElement}
			class="fixed bottom-0 left-0 right-0 z-50 bg-surface-50-950 rounded-t-2xl shadow-2xl flex flex-col"
			style="height: {sheetHeight}px; max-height: 95vh; transition: {isDraggingSheet
				? 'none'
				: 'height 0.3s ease-out'};"
			transition:fly={{ y: 500, duration: 300, easing: cubicOut }}
			role="dialog"
			aria-modal="true"
			aria-labelledby="drawer-title"
			data-drawer
		>
			<!-- Drag Handle -->
			<div
				bind:this={dragHandleElement}
				class="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
				style="touch-action: none;"
				onpointerdown={handleSheetDragStart}
				onpointermove={handleSheetDragMove}
				onpointerup={handleSheetDragEnd}
				onpointercancel={handleSheetDragEnd}
				role="slider"
				aria-valuenow={$drawerSnap === 'full' ? SNAP_FULL : SNAP_HALF}
				aria-label={m.tooltip_drag_to_close()}
				tabindex="0"
			>
				<div class="w-12 h-1.5 bg-surface-300-600 rounded-full"></div>
			</div>

			<!-- Header -->
			<div
				class="flex items-center justify-between px-4 pb-3 border-b border-surface-200-800 shrink-0"
			>
				<h2
					id="drawer-title"
					class="text-lg font-semibold text-surface-900-50 overflow-hidden text-ellipsis"
				>
					{title || 'Details'}
				</h2>
				<button
					onclick={onclose}
					class="p-2 rounded-lg hover:bg-surface-200-800 transition-colors text-surface-600-400 hover:text-surface-900-50"
					aria-label={m.tooltip_close_drawer()}
					{@attach tooltip(m.tooltip_close_drawer())}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 min-h-0 p-4 pb-20 flex flex-col overflow-y-auto">
				{@render children?.()}
			</div>
		</div>
	{:else}
		<!-- Desktop: Right Side Drawer -->
		<div
			bind:this={drawerElement}
			transition:fly={{ x: $drawerWidth, duration: 300, easing: cubicOut }}
			class="absolute top-0 right-0 h-full border-2 rounded-lg border-surface-200-800 bg-surface-50-950 shadow-xl flex flex-col z-50 {className}"
			class:transition={!resizer.isResizing}
			class:duration-500={!resizer.isResizing}
			class:ease-in-out={!resizer.isResizing}
			style="width: {$drawerWidth}px; max-width: 80vw;"
			aria-labelledby="drawer-title"
			data-drawer
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-surface-200-800 shrink-0">
				<h2
					id="drawer-title"
					class="text-lg font-semibold text-surface-900-50 overflow-hidden text-ellipsis"
				>
					{title || 'Details'}
				</h2>
				<button
					onclick={onclose}
					class="p-2 rounded-lg hover:bg-surface-200-800 transition-colors text-surface-600-400 hover:text-surface-900-50"
					aria-label={m.tooltip_close_drawer()}
					{@attach tooltip(m.tooltip_close_drawer())}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 min-h-0 p-4 flex flex-col">
				{@render children?.()}
			</div>

			<!-- Resize Handle -->
			<button
				bind:this={resizer.handleElement}
				class="touch-manipulation absolute left-0 top-0 h-full w-2 bg-transparent hover:bg-surface-300-700 active:bg-surface-300-700 cursor-col-resize transition-colors duration-200 border-none p-0 z-10"
				style="touch-action: none;"
				onpointerdown={resizer.start}
				aria-label={m.tooltip_resize_drawer()}
				{@attach tooltip(m.tooltip_resize_drawer())}
				type="button"
			></button>
		</div>
	{/if}
{/if}
