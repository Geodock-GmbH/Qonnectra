<script>
	import { drawerStore } from '$lib/stores/drawer';
	import { useSvelteFlow } from '@xyflow/svelte';
	import { parse } from 'devalue';
	import CableDiagrammEdgeAttributeCard from './CableDiagrammEdgeAttributeCard.svelte';

	let { edgeId, labelData, cableData, defaultX, defaultY, onPositionUpdate } = $props();

	// Get Svelte Flow instance for coordinate transformation
	const { screenToFlowPosition } = useSvelteFlow();

	// Position state - use saved position or default to calculated midpoint
	let position = $state({
		x: labelData?.position_x ?? defaultX,
		y: labelData?.position_y ?? defaultY
	});

	// Dragging state
	let isDragging = $state(false);
	let isMoveLabelMode = $state(false);
	let longPressTimer = $state(null);
	let dragStartPos = $state({ x: 0, y: 0 });
	let labelElement = $state(null);
	let labelWidth = $state(0);
	let labelHeight = $state(0);

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
		// Clear any existing timer
		if (longPressTimer) {
			clearTimeout(longPressTimer);
		}

		// Start long press timer (3 seconds)
		longPressTimer = setTimeout(() => {
			isMoveLabelMode = true;
			// Visual feedback could be added here
		}, 1000);
	}

	/**
	 * Handle long press cancel - cancels move mode activation
	 */
	function handleLongPressCancel() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	/**
	 * Handle label click - opens cable details if not in move mode
	 */
	async function handleLabelClick(event) {
		handleLongPressCancel();

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
