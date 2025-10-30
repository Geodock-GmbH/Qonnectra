<script>
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';

	import { drawerStore } from '$lib/stores/drawer';

	let { children, class: className = '' } = $props();

	let drawerElement = $state();
	let isResizing = $state(false);
	let startX = $state(0);
	let startWidth = $state(0);

	function handleClose() {
		drawerStore.close();
	}

	function handleKeydown(event) {
		if (event.key === 'Escape' && $drawerStore.open) {
			handleClose();
		}
	}

	function handleResizeStart(event) {
		isResizing = true;
		startX = event.clientX;
		startWidth = $drawerStore.width;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleResizeMove(event) {
		if (!isResizing) return;

		const deltaX = startX - event.clientX; // Negative because we're resizing from the right
		const newWidth = startWidth + deltaX;
		drawerStore.setWidth(newWidth);
	}

	function handleResizeEnd() {
		isResizing = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	beforeNavigate(() => {
		if ($drawerStore.open) {
			handleClose();
		}
	});

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('mousemove', handleResizeMove);
		document.addEventListener('mouseup', handleResizeEnd);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('mousemove', handleResizeMove);
			document.removeEventListener('mouseup', handleResizeEnd);
		};
	});
</script>

<!-- Drawer Card -->
{#if $drawerStore.open}
	<div
		bind:this={drawerElement}
		class=" border-2 rounded-lg border-surface-200-800 shadow-lg flex flex-col relative {className}"
		class:transition-all={!isResizing}
		class:duration-300={!isResizing}
		class:ease-in-out={!isResizing}
		style="width: {$drawerStore.width}px;"
		aria-labelledby="drawer-title"
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between p-4 border-b border-surface-200-800 flex-shrink-0"
		>
			<h2
				id="drawer-title"
				class="text-lg font-semibold text-surface-900-50 overflow-hidden text-ellipsis"
			>
				{$drawerStore.title || 'Details'}
			</h2>
			<button
				onclick={handleClose}
				class="p-2 rounded-lg hover:bg-surface-200-800 transition-colors text-surface-600-400 hover:text-surface-900-50"
				aria-label="Close drawer"
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
		<div class="flex-1 overflow-y-auto p-4">
			{#if $drawerStore.component}
				{@const Component = $drawerStore.component}
				{#key $drawerStore.key}
					<Component {...$drawerStore.props} />
				{/key}
			{:else}
				{@render children?.()}
			{/if}
		</div>

		<!-- Resize Handle -->
		<button
			class="absolute left-0 top-0 h-full w-2 bg-transparent hover:bg-surface-300-700 cursor-col-resize transition-colors duration-200 border-none p-0 z-10"
			onmousedown={handleResizeStart}
			aria-label="Resize drawer"
			type="button"
		></button>
	</div>
{/if}
