<script>
	import { quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import { IconX } from '@tabler/icons-svelte';

	let { open = $bindable(false), title = '', children } = $props();

	let sheetElement = $state(null);
	let startY = $state(0);
	let currentY = $state(0);
	let isDragging = $state(false);
	let sheetHeight = $state(50); // percentage of viewport height

	function handleTouchStart(e) {
		startY = e.touches[0].clientY;
		currentY = startY;
		isDragging = true;
	}

	function handleTouchMove(e) {
		if (!isDragging) return;
		currentY = e.touches[0].clientY;

		const deltaY = currentY - startY;
		const viewportHeight = window.innerHeight;
		const deltaPercent = (deltaY / viewportHeight) * 100;

		// Calculate new height (inverted because dragging down should decrease height)
		const newHeight = Math.max(25, Math.min(90, sheetHeight - deltaPercent));

		if (sheetElement) {
			sheetElement.style.height = `${newHeight}vh`;
		}
	}

	function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;

		const deltaY = currentY - startY;
		const viewportHeight = window.innerHeight;
		const deltaPercent = (deltaY / viewportHeight) * 100;

		// Snap to closest point or dismiss
		if (deltaPercent > 30) {
			// Dragged down significantly - dismiss
			open = false;
			sheetHeight = 50;
		} else if (deltaPercent < -20) {
			// Dragged up - expand to 90%
			sheetHeight = 90;
		} else {
			// Snap back to 50%
			sheetHeight = 50;
		}

		if (sheetElement) {
			sheetElement.style.height = `${sheetHeight}vh`;
		}
	}

	function handleBackdropClick() {
		open = false;
		sheetHeight = 50;
	}

	function handleClose() {
		open = false;
		sheetHeight = 50;
	}
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/40 z-40 md:hidden"
		transition:fade={{ duration: 200 }}
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="button"
		tabindex="-1"
	></div>

	<!-- Sheet -->
	<div
		bind:this={sheetElement}
		class="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-100-900 rounded-t-2xl shadow-2xl flex flex-col"
		style="height: {sheetHeight}vh; max-height: 90vh;"
		transition:fly={{ y: 300, duration: 300, easing: quintOut }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="sheet-title"
	>
		<!-- Drag Handle -->
		<div
			class="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
			role="slider"
			aria-valuenow={sheetHeight}
			aria-label="Drag to resize"
			tabindex="0"
		>
			<div class="w-12 h-1.5 bg-surface-400 rounded-full"></div>
		</div>

		<!-- Header -->
		<div class="flex items-center justify-between px-4 pb-3 border-b border-surface-200-800">
			<h3 id="sheet-title" class="font-semibold text-lg">{title}</h3>
			<button
				type="button"
				class="p-2 -mr-2 rounded-full hover:bg-surface-200-800 transition-colors"
				onclick={handleClose}
				aria-label="Close"
			>
				<IconX size={20} />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-auto p-4">
			{@render children?.()}
		</div>
	</div>
{/if}
