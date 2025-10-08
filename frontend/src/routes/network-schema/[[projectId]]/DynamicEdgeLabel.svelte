<script>
	import { drawerStore } from '$lib/stores/drawer';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { parse } from 'devalue';
	import CableDiagrammEdgeAttributeCard from './CableDiagrammEdgeAttributeCard.svelte';

	let { edgeId, labelData, cableData, defaultX, defaultY, onPositionUpdate } = $props();

	// Coordinate transformation
	const { screenToFlowPosition } = useSvelteFlow();

	// Position state - use saved position or default to calculated midpoint
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

		// Store the event for later use
		longPressEvent = event;

		progressValue = 0;
		showProgressCircle = false;

		// Convert screen coordinates to flow coordinates for progress ring
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

		// Add a 150ms delay before showing the progress circle
		progressDelayTimer = setTimeout(() => {
			showProgressCircle = true;
			progressDelayTimer = null;
		}, 150);

		// Animate progress value from 0 to 100 over 1 second
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

		// Start long press timer (1 second)
		longPressTimer = setTimeout(() => {
			// Clean up progress animation
			if (progressFrame) {
				cancelAnimationFrame(progressFrame);
				progressFrame = null;
			}

			// Activate move mode
			isMoveLabelMode = true;

			// Automatically start dragging with the stored event
			if (longPressEvent) {
				isDragging = true;

				// Convert screen coordinates to flow coordinates
				const flowPosition = screenToFlowPosition(
					{
						x: longPressEvent.clientX,
						y: longPressEvent.clientY
					},
					{ snapToGrid: false }
				);

				// Store the offset between mouse click and label CENTER position
				dragStartPos = {
					x: flowPosition.x - position.x,
					y: flowPosition.y - position.y
				};

				// Add event listeners for dragging
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
		// Reset progress immediately to hide ring
		progressValue = 0;
		showProgressCircle = false;
	}

	/**
	 * Handle label click - opens cable details if not in move mode
	 */
	async function handleLabelClick(event) {
		handleLongPressCancel();

		// Prevent click after dragging
		if (justFinishedDragging) {
			justFinishedDragging = false;
			return;
		}

		if (isMoveLabelMode) {
			// Exit move mode without opening drawer
			isMoveLabelMode = false;
			return;
		}

		// Open cable details drawer
		const formData = new FormData();
		formData.append('uuid', cableData?.cable?.uuid || cableData?.uuid);
		const response = await fetch('?/getCables', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		// Parse the devalue-serialized data
		const parsedData = typeof result.data === 'string' ? parse(result.data) : result.data;

		drawerStore.open({
			title: parsedData?.name || 'Cable Details',
			component: CableDiagrammEdgeAttributeCard,
			props: {
				...parsedData,
				onLabelUpdate: (newLabel) => {
					currentLabel = newLabel;
					drawerStore.setTitle(newLabel);
				}
			}
		});
	}

	/**
	 * Handle mouse down on label - starts dragging if in move mode
	 */
	function handleMouseDown(event) {
		if (!isMoveLabelMode) {
			handleLongPressStart(event);
			return;
		}

		event.stopPropagation();
		event.preventDefault();

		isDragging = true;

		// Convert screen coordinates to flow coordinates using Svelte Flow's helper
		// Disable snap-to-grid for smooth label dragging
		const flowPosition = screenToFlowPosition(
			{
				x: event.clientX,
				y: event.clientY
			},
			{ snapToGrid: false }
		);

		// Store the offset between mouse click and label CENTER position
		dragStartPos = {
			x: flowPosition.x - position.x,
			y: flowPosition.y - position.y
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	/**
	 * Handle mouse move during drag
	 */
	function handleMouseMove(event) {
		if (!isDragging) return;

		// Convert screen coordinates to flow coordinates using Svelte Flow's helper
		// Disable snap-to-grid for smooth label dragging
		const flowPosition = screenToFlowPosition(
			{
				x: event.clientX,
				y: event.clientY
			},
			{ snapToGrid: false }
		);

		// Update position by subtracting the stored offset
		position = {
			x: flowPosition.x - dragStartPos.x,
			y: flowPosition.y - dragStartPos.y
		};
	}

	/**
	 * Handle mouse up - ends dragging and saves position
	 */
	function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
			isMoveLabelMode = false;
			longPressEvent = null;
			justFinishedDragging = true;

			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);

			// Save the new position with current label text
			if (onPositionUpdate) {
				onPositionUpdate({
					labelId: labelData?.uuid,
					x: position.x,
					y: position.y,
					text: currentLabel
				});
			}

			// Reset the flag after a short delay to allow normal clicks again
			setTimeout(() => {
				justFinishedDragging = false;
			}, 100);
		}
	}

	/**
	 * Handle keydown for accessibility
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
</script>

<!-- Label -->
{#if currentLabel}
	<foreignObject
		x={labelWidth > 0 ? position.x - labelWidth / 2 : position.x - 50}
		y={position.y - 12}
		width={labelWidth > 0 ? labelWidth : 100}
		height={labelHeight > 0 ? labelHeight : 100}
		style="cursor: {isMoveLabelMode ? 'move' : 'pointer'}; pointer-events: bounding-box;"
		onclick={handleLabelClick}
		onmousedown={handleMouseDown}
		onmouseup={handleLongPressCancel}
		onmouseleave={handleLongPressCancel}
		onkeydown={handleKeydown}
		aria-label={isMoveLabelMode
			? 'Move label (click to exit)'
			: 'Open cable details for ' + currentLabel}
		role="button"
		tabindex="0"
		class="nopan"
	>
		<div class="flex items-center justify-center">
			<div
				bind:this={labelElement}
				class="z-10 bg-surface-50-950 border rounded px-2 py-1 text-xs text-center shadow-sm font-medium {isMoveLabelMode
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
