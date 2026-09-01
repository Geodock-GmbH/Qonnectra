<script lang="ts">
	import type { EdgeLabelData } from '$lib/classes/NetworkSchemaState.svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconPencil, IconPencilOff } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore } from '$lib/stores/drawer';
	import { getSchemaState } from '$lib/context/networkSchemaContext';

	import DrawerTabs from './DrawerTabs.svelte';

	interface CableData {
		label?: string;
		uuid?: string;
		cable?: { uuid?: string; name?: string };
	}

	let {
		edgeId,
		labelData,
		cableData,
		defaultX,
		defaultY,
		onPositionUpdate,
		onLabelReset,
		onEdgeDelete,
		onEdgeSelect,
		onNameUpdate,
		selected = false
	}: {
		edgeId: string;
		labelData?: Partial<EdgeLabelData> | null;
		cableData?: CableData | null;
		defaultX: number;
		defaultY: number;
		onPositionUpdate?: (data: {
			labelId?: string;
			x: number;
			y: number;
			text?: string;
		}) => boolean | Promise<boolean>;
		onLabelReset?: (labelId: string) => boolean | Promise<boolean>;
		onEdgeDelete?: unknown;
		onEdgeSelect?: (edgeId: string) => void;
		onNameUpdate?: (label: string) => void;
		selected?: boolean;
	} = $props();

	const schemaState = getSchemaState();

	let labelHovered = $state(false);

	const { screenToFlowPosition } = useSvelteFlow();

	// Drag-time / optimistic position. Null means "derive from labelData/props".
	let positionOverride = $state<{ x: number; y: number } | null>(null);
	let position = $derived(
		positionOverride ?? {
			x: labelData?.position_x ?? defaultX,
			y: labelData?.position_y ?? defaultY
		}
	);

	let isDragging = $state(false);
	let isMoveLabelMode = $state(false);
	let justFinishedDragging = $state(false);
	let longPressTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let longPressEvent = $state<MouseEvent | null>(null);
	let dragStartPos = $state({ x: 0, y: 0 });
	let labelWidth = $state(0);
	let labelHeight = $state(0);

	let progressValue = $state(0);
	let progressPosition = $state({ x: 0, y: 0 });
	let progressFrame = $state<number | null>(null);
	let showProgressCircle = $state(false);
	let progressDelayTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	let currentLabel = $derived(labelData?.text || cableData?.label || cableData?.cable?.name || '');

	/**
	 * Handle long press start - begins timer for move mode
	 * @param event - The mouse event
	 */
	function handleLongPressStart(event: MouseEvent) {
		// A label can always be clicked to open details, but it can only be moved
		// when its own cable is in edit mode (canvas unlocked + this edit target),
		// so the long-press that arms move mode must not start otherwise.
		if (!schemaState.isEditing(edgeId)) {
			return;
		}
		// A Shift+Click is a reset gesture and an Alt+Click is the fast edit-mode
		// switch; starting the long-press for either would flip into move mode on a
		// slow click and re-save the label instead.
		if (event.shiftKey || event.altKey) {
			return;
		}
		if (longPressTimer) {
			clearTimeout(longPressTimer);
		}
		if (progressFrame) {
			cancelAnimationFrame(progressFrame);
		}
		if (progressDelayTimer) {
			clearTimeout(progressDelayTimer);
		}

		longPressEvent = event;

		progressValue = 0;
		showProgressCircle = false;

		const flowPos = screenToFlowPosition(
			{
				x: event.clientX,
				y: event.clientY
			},
			{ snapToGrid: false }
		);
		progressPosition = {
			x: flowPos.x,
			y: flowPos.y
		};

		progressDelayTimer = setTimeout(() => {
			showProgressCircle = true;
			progressDelayTimer = null;
		}, 150);

		const startTime = Date.now();
		const duration = 500;

		function updateProgress() {
			const elapsed = Date.now() - startTime;
			progressValue = Math.min((elapsed / duration) * 100, 100);

			if (elapsed < duration) {
				progressFrame = requestAnimationFrame(updateProgress);
			} else {
				progressValue = 100;
				progressFrame = null;
			}
		}
		progressFrame = requestAnimationFrame(updateProgress);

		longPressTimer = setTimeout(() => {
			if (progressFrame) {
				cancelAnimationFrame(progressFrame);
				progressFrame = null;
			}

			isMoveLabelMode = true;

			if (longPressEvent) {
				isDragging = true;

				const flowPosition = screenToFlowPosition(
					{
						x: longPressEvent.clientX,
						y: longPressEvent.clientY
					},
					{ snapToGrid: false }
				);

				dragStartPos = {
					x: flowPosition.x - position.x,
					y: flowPosition.y - position.y
				};

				window.addEventListener('mousemove', handleMouseMove);
				window.addEventListener('mouseup', handleMouseUp);
			}
		}, duration);
	}

	/**
	 * Handle long press cancel - cancels move mode activation
	 */
	function handleLongPressCancel() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		if (progressFrame) {
			cancelAnimationFrame(progressFrame);
			progressFrame = null;
		}
		if (progressDelayTimer) {
			clearTimeout(progressDelayTimer);
			progressDelayTimer = null;
		}
		longPressEvent = null;
		progressValue = 0;
		showProgressCircle = false;
	}

	/**
	 * Handle label click - opens cable details if not in move mode.
	 * Alt+Click fast-switches edit mode to this cable; Shift+Click resets the
	 * label position to the edge midpoint.
	 * @param event - The mouse event
	 */
	async function handleLabelClick(event: MouseEvent) {
		handleLongPressCancel();

		if (justFinishedDragging) {
			justFinishedDragging = false;
			return;
		}

		if (isMoveLabelMode) {
			isMoveLabelMode = false;
			return;
		}

		// Alt+Click is the fast edit-mode switch: it moves editing to this cable
		// instantly, without opening the details drawer. It replaces the old
		// Shift+right-click switch, which Firefox and Safari intercept for their
		// native context menu before any page handler runs.
		if (event.altKey) {
			event.preventDefault();
			event.stopPropagation();
			schemaState.enterEditMode(edgeId);
			return;
		}

		// Shift+Click to reset label position. Only allowed while this cable is in
		// edit mode so an idle canvas cannot mutate label positions. The event's
		// own modifier is authoritative; the tracked shiftPressed state can go
		// stale when the keydown happened while focus was outside the window.
		if (schemaState.isEditing(edgeId) && event.shiftKey && labelData?.uuid && onLabelReset) {
			event.preventDefault();
			event.stopPropagation();
			// Optimistically show the default position, but roll back if the
			// delete does not persist so the UI never lies. On success we keep
			// the override; the cleared labelData derives to the same default.
			positionOverride = { x: defaultX, y: defaultY };
			const persisted = await onLabelReset(labelData.uuid);
			if (persisted === false) {
				positionOverride = null;
			}
			return;
		}

		// Select the edge to show highlight
		if (onEdgeSelect) {
			onEdgeSelect(edgeId);
		}

		const parsedData = await schemaState.loadCableDetails(
			cableData?.cable?.uuid || cableData?.uuid || ''
		);

		drawerStore.open({
			title: (parsedData?.name as string) || m.title_cable_details(),
			component: DrawerTabs,
			props: {
				...parsedData,
				type: 'edge',
				onLabelUpdate: (newLabel: string) => {
					drawerStore.setTitle(newLabel);
					onNameUpdate?.(newLabel);
				},
				onEdgeDelete
			}
		});
	}

	/**
	 * Handle mouse down on label - starts dragging if in move mode
	 * @param event - The mouse event
	 */
	function handleMouseDown(event: MouseEvent) {
		// Only the left button drives move/long-press. A right-button press must
		// fall through to the contextmenu handler untouched — otherwise it arms
		// the long-press timer and window listeners, which then swallow the
		// right-click that should open the menu.
		if (event.button !== 0) {
			return;
		}

		if (!isMoveLabelMode) {
			handleLongPressStart(event);
			return;
		}

		event.stopPropagation();
		event.preventDefault();

		isDragging = true;

		const flowPosition = screenToFlowPosition(
			{
				x: event.clientX,
				y: event.clientY
			},
			{ snapToGrid: false }
		);

		dragStartPos = {
			x: flowPosition.x - position.x,
			y: flowPosition.y - position.y
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	/**
	 * Handle mouse move during drag
	 * @param event - The mouse event
	 */
	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;

		const flowPosition = screenToFlowPosition(
			{
				x: event.clientX,
				y: event.clientY
			},
			{ snapToGrid: false }
		);

		positionOverride = {
			x: flowPosition.x - dragStartPos.x,
			y: flowPosition.y - dragStartPos.y
		};
	}

	/**
	 * Handle mouse up - ends dragging and saves position
	 */
	async function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
			isMoveLabelMode = false;
			longPressEvent = null;
			justFinishedDragging = true;

			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);

			if (onPositionUpdate) {
				const persisted = await onPositionUpdate({
					labelId: labelData?.uuid,
					x: position.x,
					y: position.y,
					text: currentLabel
				});
				// On success the new position lives in labelData; drop the override
				// so props are authoritative. On failure keep the dragged position.
				if (persisted) {
					positionOverride = null;
				}
			}

			setTimeout(() => {
				justFinishedDragging = false;
			}, 100);
		}
	}

	/**
	 * Handle keydown for accessibility
	 * @param event - The keyboard event
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleLabelClick(event as unknown as MouseEvent);
		}
		// Escape leaves the label's local move mode; exiting edit mode itself is
		// handled once at the page's window-level keydown so it works canvas-wide.
		if (event.key === 'Escape' && isMoveLabelMode) {
			isMoveLabelMode = false;
		}
	}

	let isEditingThis = $derived(schemaState.isEditing(edgeId));

	// Right-click menu, positioned at the pointer with `position: fixed` in a
	// Portal. Skeleton/Zag's Menu positions from the trigger's bounding rect,
	// which is distorted for this label because it lives inside an SVG
	// `foreignObject` under SvelteFlow's transformed viewport — the menu ended up
	// at the top-left of the window. A `contextmenu` event's client coordinates
	// are true viewport pixels regardless of ancestor transforms, so a fixed-
	// positioned menu at those coordinates lands exactly under the cursor.
	let menuOpen = $state(false);
	let menuX = $state(0);
	let menuY = $state(0);

	/**
	 * Handle right-click on the label: open the context menu at the pointer. The
	 * fast edit-mode switch is Alt+Click (see `handleLabelClick`), not a modified
	 * right-click — Firefox and Safari intercept Shift+right-click for their own
	 * native menu before any page handler runs, so it could never work here.
	 * @param event - The contextmenu mouse event
	 */
	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		menuX = event.clientX;
		menuY = event.clientY;
		menuOpen = true;
	}

	/**
	 * Close the context menu.
	 */
	function closeMenu() {
		menuOpen = false;
	}

	/**
	 * Enter this cable's edit mode from the menu, then close it.
	 */
	function editFromMenu() {
		schemaState.enterEditMode(edgeId);
		closeMenu();
	}

	/**
	 * Leave edit mode from the menu, then close it.
	 */
	function stopEditingFromMenu() {
		schemaState.exitEditMode();
		closeMenu();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (menuOpen && e.key === 'Escape') closeMenu();
	}}
/>

<!-- Label -->
{#if currentLabel}
	{@const isResetMode =
		schemaState.isEditing(edgeId) && schemaState?.shiftPressed && labelHovered && labelData?.uuid}
	{@const cursorStyle = isResetMode ? 'crosshair' : isMoveLabelMode ? 'move' : 'pointer'}
	<foreignObject
		x={labelWidth > 0 ? position.x - labelWidth / 2 : position.x - 50}
		y={position.y - 12}
		width={labelWidth > 0 ? labelWidth : 100}
		height={labelHeight > 0 ? labelHeight : 100}
		style="pointer-events: none; outline: none;"
		role="presentation"
		class="nopan"
	>
		<!--
			Only the visible label box is interactive: the foreignObject has
			`pointer-events: none` and the inner box re-enables them. The old
			`pointer-events: bounding-box` on the foreignObject let its full (often
			oversized) rect capture clicks, so overlapping labels stole each other's
			right-clicks — which broke the edit-mode switch this feature exists to fix.
		-->
		<div class="flex w-full h-full items-center justify-center" style="pointer-events: none;">
			<div
				bind:clientWidth={null, (w) => (labelWidth = w && w > 0 ? w + 20 : 0)}
				bind:clientHeight={null, (h) => (labelHeight = h && h > 0 ? h + 20 : 0)}
				style="pointer-events: auto; cursor: {cursorStyle};"
				role="button"
				tabindex="0"
				onmousedown={handleMouseDown}
				onmouseup={handleLongPressCancel}
				oncontextmenucapture={handleContextMenu}
				onmouseenter={() => (labelHovered = true)}
				onmouseleave={() => {
					labelHovered = false;
					handleLongPressCancel();
				}}
				onclick={handleLabelClick}
				onkeydown={handleKeydown}
				aria-label={isResetMode
					? m.tooltip_click_to_reset_label_position()
					: isMoveLabelMode
						? m.tooltip_move_label_click_to_exit()
						: m.tooltip_open_cable_details({ label: currentLabel })}
				class="z-10 bg-surface-50-950 border rounded px-2 py-1 text-xs text-center shadow-sm font-medium focus:outline-none {isResetMode
					? 'border-error-500  ring-error-400 bg-error-50 dark:bg-error-950'
					: isEditingThis
						? 'border-primary-500 ring-2 ring-primary-400'
						: isMoveLabelMode || selected
							? 'border-primary-500  ring-primary-400'
							: 'border-surface-200-700'}"
			>
				{currentLabel}
			</div>
		</div>
	</foreignObject>
{/if}

<!-- Right-click menu, portalled out of the SVG and pinned at the pointer -->
{#if menuOpen}
	<Portal>
		<!-- Full-screen catcher closes the menu on any outside click / right-click -->
		<div
			class="fixed inset-0 z-40"
			role="presentation"
			onpointerdown={closeMenu}
			oncontextmenu={(e) => {
				e.preventDefault();
				closeMenu();
			}}
		></div>
		<div
			class="card bg-surface-50-950 p-2 shadow-xl space-y-1 min-w-48 fixed z-50 border border-surface-200-700 rounded"
			style="left: {menuX}px; top: {menuY}px;"
			role="menu"
			tabindex="-1"
		>
			{#if isEditingThis}
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-surface-100-900 text-sm"
					onclick={stopEditingFromMenu}
				>
					<IconPencilOff size={16} class="shrink-0" />
					<span>{m.action_stop_editing_cable()}</span>
				</button>
			{:else}
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-surface-100-900 text-sm"
					onclick={editFromMenu}
				>
					<IconPencil size={16} class="shrink-0" />
					<span>{m.action_edit_cable()}</span>
				</button>
			{/if}
		</div>
	</Portal>
{/if}

<!-- Progress ring overlay near mouse cursor -->
{#if showProgressCircle && progressValue < 100}
	<g transform="translate({progressPosition.x} {progressPosition.y})" pointer-events="none">
		<circle
			cx="0"
			cy="0"
			r="20"
			fill="none"
			stroke="var(--color-surface-400)"
			stroke-width="3"
			opacity="0.3"
		/>
		<circle
			cx="0"
			cy="0"
			r="20"
			fill="none"
			stroke="var(--color-primary-500)"
			stroke-width="3"
			stroke-dasharray="{(progressValue / 100) * 125.6} 125.6"
			stroke-linecap="round"
			transform="rotate(-90)"
		/>
	</g>
{/if}
