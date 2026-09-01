<script lang="ts">
	import type { EdgeLabelData } from '$lib/classes/NetworkSchemaState.svelte';
	import { useSvelteFlow } from '@xyflow/svelte';

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
		// While the canvas is locked, labels can be clicked to open details but
		// never moved, so the long-press that arms move mode must not start.
		if (schemaState.locked) {
			return;
		}
		// A Shift+Click is a reset gesture; starting the long-press here would
		// flip into move mode on a slow click and re-save the label instead.
		if (event.shiftKey) {
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
	 * Handle label click - opens cable details if not in move mode
	 * Shift+Click resets label position to edge midpoint
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

		// Shift+Click to reset label position. Blocked while locked so a locked
		// canvas cannot mutate label positions. The event's own modifier is
		// authoritative; the tracked shiftPressed state can go stale when the
		// keydown happened while focus was outside the window.
		if (!schemaState.locked && event.shiftKey && labelData?.uuid && onLabelReset) {
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
		if (event.key === 'Escape' && isMoveLabelMode) {
			isMoveLabelMode = false;
		}
	}
</script>

<!-- Label -->
{#if currentLabel}
	{@const isResetMode =
		!schemaState.locked && schemaState?.shiftPressed && labelHovered && labelData?.uuid}
	{@const cursorStyle = isResetMode ? 'crosshair' : isMoveLabelMode ? 'move' : 'pointer'}
	<foreignObject
		x={labelWidth > 0 ? position.x - labelWidth / 2 : position.x - 50}
		y={position.y - 12}
		width={labelWidth > 0 ? labelWidth : 100}
		height={labelHeight > 0 ? labelHeight : 100}
		style="cursor: {cursorStyle}; pointer-events: bounding-box; outline: none;"
		onmousedown={handleMouseDown}
		onmouseup={handleLongPressCancel}
		onmouseenter={() => (labelHovered = true)}
		onmouseleave={() => {
			labelHovered = false;
			handleLongPressCancel();
		}}
		role="presentation"
		class="nopan"
	>
		<div
			class="flex items-center justify-center focus:outline-none"
			role="button"
			tabindex="0"
			onclick={handleLabelClick}
			onkeydown={handleKeydown}
			aria-label={isResetMode
				? m.tooltip_click_to_reset_label_position()
				: isMoveLabelMode
					? m.tooltip_move_label_click_to_exit()
					: m.tooltip_open_cable_details({ label: currentLabel })}
		>
			<div
				bind:clientWidth={null, (w) => (labelWidth = w && w > 0 ? w + 20 : 0)}
				bind:clientHeight={null, (h) => (labelHeight = h && h > 0 ? h + 20 : 0)}
				class="z-10 bg-surface-50-950 border rounded px-2 py-1 text-xs text-center shadow-sm font-medium {isResetMode
					? 'border-error-500  ring-error-400 bg-error-50 dark:bg-error-950'
					: isMoveLabelMode || selected
						? 'border-primary-500  ring-primary-400'
						: 'border-surface-200-700'}"
			>
				{currentLabel}
			</div>
		</div>
	</foreignObject>
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
