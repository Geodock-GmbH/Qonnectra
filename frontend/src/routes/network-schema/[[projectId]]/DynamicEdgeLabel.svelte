<script>
	import { useSvelteFlow } from '@xyflow/svelte';
	import { parse } from 'devalue';

	import { drawerStore } from '$lib/stores/drawer';

	import DrawerTabs from './DrawerTabs.svelte';

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
		selected = false
	} = $props();

	// Shift key tracking for label reset
	let shiftPressed = $state(false);
	let labelHovered = $state(false);

	// Coordinate transformation
	const { screenToFlowPosition } = useSvelteFlow();

	let position = $state({
		x: labelData?.position_x ?? defaultX,
		y: labelData?.position_y ?? defaultY
	});

	// Dragging state
	let isDragging = $state(false);
	let isMoveLabelMode = $state(false);
	let justFinishedDragging = $state(false);
	let longPressTimer = $state(null);
	let longPressEvent = $state(null);
	let dragStartPos = $state({ x: 0, y: 0 });
	let labelElement = $state(null);
	let labelWidth = $state(0);
	let labelHeight = $state(0);

	// Progress ring state for visual feedback
	let progressValue = $state(0);
	let progressPosition = $state({ x: 0, y: 0 });
	let progressFrame = $state(null);
	let showProgressCircle = $state(false);
	let progressDelayTimer = $state(null);

	// Local reactive state for the label text
	let currentLabel = $state(labelData?.text || cableData?.label || cableData?.cable?.name || '');

	/**
	 * Update label dimensions when element is bound
	 */
	$effect(() => {
		if (labelElement && currentLabel) {
			labelWidth = labelElement.offsetWidth + 20;
			labelHeight = labelElement.offsetHeight + 20;
		}
	});

	/**
	 * Sync label text when data changes
	 */
	$effect(() => {
		if (labelData?.text) {
			currentLabel = labelData.text;
		}
	});

	/**
	 * Sync position when labelData changes
	 */
	$effect(() => {
		if (labelData?.position_x !== undefined && labelData?.position_y !== undefined) {
			position = {
				x: labelData.position_x,
				y: labelData.position_y
			};
		}
	});

	/**
	 * Handle long press start - begins timer for move mode
	 * @param {MouseEvent} event - The mouse event
	 */
	function handleLongPressStart(event) {
		// Clear any existing timers/intervals
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
	 * @param {MouseEvent} event - The mouse event
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
	 * @param {MouseEvent} event - The mouse event
	 */
	async function handleLabelClick(event) {
		handleLongPressCancel();

		if (justFinishedDragging) {
			justFinishedDragging = false;
			return;
		}

		if (isMoveLabelMode) {
			isMoveLabelMode = false;
			return;
		}

		// Shift+Click to reset label position
		if (shiftPressed && labelData?.uuid && onLabelReset) {
			event.preventDefault();
			event.stopPropagation();
			// Reset local position immediately for instant feedback
			position = { x: defaultX, y: defaultY };
			onLabelReset(labelData.uuid);
			return;
		}

		// Select the edge to show highlight
		if (onEdgeSelect) {
			onEdgeSelect(edgeId);
		}

		const formData = new FormData();
		formData.append('uuid', cableData?.cable?.uuid || cableData?.uuid);
		const response = await fetch('?/getCables', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		const parsedData = typeof result.data === 'string' ? parse(result.data) : result.data;

		drawerStore.open({
			title: parsedData?.name || 'Cable Details',
			component: DrawerTabs,
			props: {
				...parsedData,
				type: 'edge',
				onLabelUpdate: (newLabel) => {
					currentLabel = newLabel;
					drawerStore.setTitle(newLabel);
				},
				onEdgeDelete
			}
		});
	}

	/**
	 * Handle mouse down on label - starts dragging if in move mode
	 * @param {MouseEvent} event - The mouse event
	 */
	function handleMouseDown(event) {
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
	 * @param {MouseEvent} event - The mouse event
	 */
	function handleMouseMove(event) {
		if (!isDragging) return;

		const flowPosition = screenToFlowPosition(
			{
				x: event.clientX,
				y: event.clientY
			},
			{ snapToGrid: false }
		);

		position = {
			x: flowPosition.x - dragStartPos.x,
			y: flowPosition.y - dragStartPos.y
		};
	}

	/**
	 * Handle mouse up - ends dragging and saves position
	 * @param {MouseEvent} event - The mouse event
	 */
	function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
			isMoveLabelMode = false;
			longPressEvent = null;
			justFinishedDragging = true;

			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);

			if (onPositionUpdate) {
				onPositionUpdate({
					labelId: labelData?.uuid,
					x: position.x,
					y: position.y,
					text: currentLabel
				});
			}

			setTimeout(() => {
				justFinishedDragging = false;
			}, 100);
		}
	}

	/**
	 * Handle keydown for accessibility
	 * @param {KeyboardEvent} event - The keyboard event
	 */
	function handleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleLabelClick(event);
		}
		if (event.key === 'Escape' && isMoveLabelMode) {
			isMoveLabelMode = false;
		}
	}

	/**
	 * Handle global keyboard events for Shift key tracking
	 */
	function handleGlobalKeyDown(event) {
		if (event.key === 'Shift') {
			shiftPressed = true;
		}
	}

	function handleGlobalKeyUp(event) {
		if (event.key === 'Shift') {
			shiftPressed = false;
		}
	}

	// Attach global keyboard listeners
	$effect(() => {
		window.addEventListener('keydown', handleGlobalKeyDown);
		window.addEventListener('keyup', handleGlobalKeyUp);

		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown);
			window.removeEventListener('keyup', handleGlobalKeyUp);
		};
	});
</script>

<!-- Label -->
{#if currentLabel}
	{@const isResetMode = shiftPressed && labelHovered && labelData?.uuid}
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
				? 'Click to reset label position'
				: isMoveLabelMode
					? 'Move label (click to exit)'
					: 'Open cable details for ' + currentLabel}
		>
			<div
				bind:this={labelElement}
				class="z-10 bg-surface-50-950 border rounded px-2 py-1 text-xs text-center shadow-sm font-medium {isResetMode
					? 'border-error-500 ring-2 ring-error-400 bg-error-50 dark:bg-error-950'
					: isMoveLabelMode || selected
						? 'border-primary-500 ring-2 ring-primary-400'
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
