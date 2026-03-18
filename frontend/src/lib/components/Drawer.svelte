<script>
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { innerWidth } from 'svelte/reactivity/window';
	import { fade, fly } from 'svelte/transition';
	import { beforeNavigate } from '$app/navigation';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore as rawDrawerStore } from '$lib/stores/drawer';
	import { drawerSnap } from '$lib/stores/store';
	import { tooltip } from '$lib/utils/tooltip.js';

	/**
	 * @typedef {Object} DrawerStoreType
	 * @property {(fn: (value: any) => void) => () => void} subscribe
	 * @property {(options?: {title?: string, component?: any, props?: Record<string, any>, width?: number|null}) => void} open
	 * @property {() => void} close
	 * @property {(title: string) => void} setTitle
	 * @property {(component: any, props?: Record<string, any>) => void} setComponent
	 * @property {(width: number) => void} setWidth
	 * @property {(newProps: Record<string, any>) => void} updateProps
	 */

	/** @type {DrawerStoreType} */
	const drawerStore = /** @type {any} */ (rawDrawerStore);

	let { children = undefined, class: className = '' } = $props();

	/** @type {HTMLDivElement | undefined} */
	let drawerElement = $state();
	let isResizing = $state(false);
	let startX = $state(0);
	let startWidth = $state(0);
	let activePointerId = $state(/** @type {number | null} */ (null));

	/** @type {HTMLButtonElement | undefined} */
	let resizeHandleElement = $state();

	/** @type {import('svelte/store').Writable<{open: boolean, title: string, component: any, props: Record<string, any>, width: number}>} */
	const typedStore = /** @type {any} */ (drawerStore);
	let drawerOpen = $derived($typedStore.open);
	let drawerTitle = $derived($typedStore.title);
	let drawerWidth = $derived($typedStore.width);
	let DrawerComponent = $derived($typedStore.component);
	let drawerProps = $derived($typedStore.props);

	let isMobile = $derived((innerWidth.current ?? 0) < 768);

	// --- Mobile bottom sheet state ---
	let isDraggingSheet = $state(false);
	let dragHeight = $state(0);
	let sheetStartY = $state(0);
	let sheetPointerId = $state(/** @type {number | null} */ (null));
	/** @type {HTMLDivElement | undefined} */
	let dragHandleElement = $state();

	const SNAP_HALF = 50;
	const SNAP_FULL = 95;
	const SNAP_THRESHOLD = 0.25;

	/** @returns {number} Height in pixels for a given snap vh value */
	function snapToPixels(/** @type {number} */ snapVh) {
		return (snapVh / 100) * window.innerHeight;
	}

	/** Current snap height in pixels */
	let snapHeight = $derived(snapToPixels($drawerSnap === 'full' ? SNAP_FULL : SNAP_HALF));

	/** The height to render: during drag use live value, otherwise use snap */
	let sheetHeight = $derived(isDraggingSheet ? dragHeight : snapHeight);

	/**
	 * Closes the drawer by updating the drawer store state
	 */
	function handleClose() {
		drawerStore.close();
	}

	/**
	 * Handles keyboard shortcuts for the drawer
	 * @param {KeyboardEvent} event
	 */
	function handleKeydown(event) {
		if (event.key === 'Escape' && drawerOpen) {
			handleClose();
		}
	}

	// --- Desktop resize handlers ---

	/**
	 * Initiates the drawer resize operation
	 * @param {PointerEvent} event
	 */
	function handleResizeStart(event) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;

		isResizing = true;
		activePointerId = event.pointerId;
		startX = event.clientX;
		startWidth = $typedStore.width;

		event.preventDefault();
		resizeHandleElement?.setPointerCapture?.(event.pointerId);

		if (event.pointerType === 'mouse') {
			document.body.style.cursor = 'col-resize';
		}
		document.body.style.userSelect = 'none';
	}

	/**
	 * Handles pointer movement during drawer resize
	 * @param {PointerEvent} event
	 */
	function handleResizeMove(event) {
		if (!isResizing) return;
		if (activePointerId !== null && event.pointerId !== activePointerId) return;

		const deltaX = startX - event.clientX;
		const newWidth = startWidth + deltaX;
		drawerStore.setWidth(newWidth);
	}

	/**
	 * Completes the drawer resize operation
	 * @param {PointerEvent} [event]
	 */
	function handleResizeEnd(event) {
		isResizing = false;
		if (event && activePointerId !== null && event.pointerId === activePointerId) {
			try {
				resizeHandleElement?.releasePointerCapture?.(activePointerId);
			} catch {
				// ignore if capture is already released
			}
		}
		activePointerId = null;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	// --- Mobile sheet drag handlers ---

	/**
	 * Initiates the mobile sheet drag
	 * @param {PointerEvent} event
	 */
	function handleSheetDragStart(event) {
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
	 * @param {PointerEvent} event
	 */
	function handleSheetDragMove(event) {
		if (!isDraggingSheet) return;
		if (sheetPointerId !== null && event.pointerId !== sheetPointerId) return;

		const deltaY = sheetStartY - event.clientY;
		const minHeight = 0;
		const maxHeight = snapToPixels(SNAP_FULL);
		dragHeight = Math.max(minHeight, Math.min(snapHeight + deltaY, maxHeight));
	}

	/**
	 * Completes the sheet drag and snaps to appropriate position
	 * @param {PointerEvent} [event]
	 */
	function handleSheetDragEnd(event) {
		if (!isDraggingSheet) return;

		if (event && sheetPointerId !== null && event.pointerId !== sheetPointerId) return;

		const halfPx = snapToPixels(SNAP_HALF);
		const fullPx = snapToPixels(SNAP_FULL);
		const midpoint = (halfPx + fullPx) / 2;
		const dismissThreshold = halfPx * (1 - SNAP_THRESHOLD);

		if (dragHeight < dismissThreshold) {
			handleClose();
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

	/**
	 * Reactive effect that adjusts drawer width when viewport changes (desktop only)
	 */
	$effect(() => {
		if (isMobile) return;
		const maxWidth = Math.floor((innerWidth.current ?? 0) * 0.8);
		if (drawerWidth > maxWidth) {
			drawerStore.setWidth(maxWidth);
		}
	});

	beforeNavigate(() => {
		if (drawerOpen) {
			handleClose();
		}
	});

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('pointermove', handleResizeMove);
		document.addEventListener('pointerup', handleResizeEnd);
		document.addEventListener('pointercancel', handleResizeEnd);

		return () => {
			document.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('pointermove', handleResizeMove);
			document.removeEventListener('pointerup', handleResizeEnd);
			document.removeEventListener('pointercancel', handleResizeEnd);
		};
	});
</script>

{#if drawerOpen}
	{#if isMobile}
		<!-- Mobile: Bottom Sheet -->
		<!-- Backdrop -->
		<button
			class="fixed inset-0 bg-black/40 z-40"
			transition:fade={{ duration: 200 }}
			onclick={handleClose}
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
					{drawerTitle || 'Details'}
				</h2>
				<button
					onclick={handleClose}
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
				{#if DrawerComponent}
					<DrawerComponent {...drawerProps} />
				{:else}
					{@render children?.()}
				{/if}
			</div>
		</div>
	{:else}
		<!-- Desktop: Right Side Drawer -->
		<div
			bind:this={drawerElement}
			transition:fly={{ x: drawerWidth, duration: 300, easing: cubicOut }}
			class="absolute top-0 right-0 h-full border-2 rounded-lg border-surface-200-800 bg-surface-50-950 shadow-xl flex flex-col z-50 {className}"
			class:transition={!isResizing}
			class:duration-500={!isResizing}
			class:ease-in-out={!isResizing}
			style="width: {drawerWidth}px; max-width: 80vw;"
			aria-labelledby="drawer-title"
			data-drawer
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-surface-200-800 shrink-0">
				<h2
					id="drawer-title"
					class="text-lg font-semibold text-surface-900-50 overflow-hidden text-ellipsis"
				>
					{drawerTitle || 'Details'}
				</h2>
				<button
					onclick={handleClose}
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
				{#if DrawerComponent}
					<DrawerComponent {...drawerProps} />
				{:else}
					{@render children?.()}
				{/if}
			</div>

			<!-- Resize Handle -->
			<button
				bind:this={resizeHandleElement}
				class="touch-manipulation absolute left-0 top-0 h-full w-2 bg-transparent hover:bg-surface-300-700 active:bg-surface-300-700 cursor-col-resize transition-colors duration-200 border-none p-0 z-10"
				style="touch-action: none;"
				onpointerdown={handleResizeStart}
				aria-label={m.tooltip_resize_drawer()}
				{@attach tooltip(m.tooltip_resize_drawer())}
				type="button"
			></button>
		</div>
	{/if}
{/if}
