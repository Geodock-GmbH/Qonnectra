<script>
	import { IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		fiber = null,
		hasPort = true,
		side = 'a',
		colorHex = '#999999',
		onDrop = () => {},
		onClear = () => {},
		// Merge props
		isMerged = false,
		mergedCount = 0,
		connectedCount = 0
	} = $props();

	let isDragOver = $state(false);

	// Color accent based on side
	const accentClasses = $derived(
		side === 'a'
			? {
					bg: 'bg-secondary-50-950',
					bgHover: 'bg-secondary-200-800',
					outline: 'outline-blue-400',
					clearHover: 'hover:bg-secondary-50-950'
				}
			: {
					bg: 'bg-secondary-50-950',
					bgHover: 'bg-secondary-200-800',
					outline: 'outline-amber-400',
					clearHover: 'hover:bg-secondary-50-950'
				}
	);

	function handleDragOver(e) {
		if (!hasPort) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e) {
		if (!hasPort) return;
		e.preventDefault();
		isDragOver = false;

		const jsonData = e.dataTransfer.getData('application/json');
		if (jsonData) {
			try {
				const data = JSON.parse(jsonData);
				onDrop(data);
			} catch (err) {
				console.error('Failed to parse drop data:', err);
			}
		}
	}
</script>

<div
	class="fiber-cell relative px-3 py-2 min-h-[44px] transition-all duration-150 border-l border-surface-200-800 {!hasPort
		? 'bg-surface-200-800 cursor-not-allowed'
		: ''} {isDragOver && hasPort
		? `${accentClasses.bgHover} outline  outline-dashed ${accentClasses.outline}`
		: ''} {fiber ? accentClasses.bg : ''} flex items-center"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role={hasPort ? 'button' : 'presentation'}
>
	{#if fiber}
		<!-- Connected Fiber Display -->
		<div class="flex items-center gap-2 group w-full">
			<span
				class="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
				style="background-color: {colorHex}"
			></span>
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-1.5 text-sm font-medium">
					<span class="font-mono">{fiber.fiber_number}</span>
					<span class="text-surface-400">|</span>
					<span class="text-surface-500">B{fiber.bundle_number}</span>
					{#if isMerged && connectedCount > 0}
						<span
							class="text-xs px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-500 font-medium"
						>
							{connectedCount}/{mergedCount}
						</span>
					{/if}
				</div>
				<div class="text-xs text-surface-400 truncate">
					{fiber.cable_name}
				</div>
			</div>
			<button
				type="button"
				class="btn-sm ml-auto p-1 rounded-md opacity-0 group-hover:opacity-100 bg-error-500 hover:bg-error-600 text-white transition-all flex-shrink-0"
				onclick={(e) => {
					e.stopPropagation();
					onClear();
				}}
				aria-label={m.common_clear?.() || 'Clear'}
			>
				<IconTrash size={20} />
			</button>
		</div>
	{:else if hasPort}
		<!-- Empty Drop Zone -->
		<div class="flex items-center justify-center w-full text-surface-400">
			<div class="flex items-center gap-2 text-xs italic">
				{#if isMerged}
					<span>
						{m.message_drop_fibers_here?.({ count: mergedCount }) ||
							`Drop ${mergedCount} fibers here`}
					</span>
				{:else}
					<span>{m.message_drop_fiber_here?.() || 'Faser hier ablegen'}</span>
				{/if}
			</div>
		</div>
	{:else}
		<!-- No Port -->
		<div class="flex items-center justify-center h-full">
			<span class="text-surface-300 text-sm">-</span>
		</div>
	{/if}
</div>
