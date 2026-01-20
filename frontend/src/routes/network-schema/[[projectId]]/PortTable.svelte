<script>
	import { IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FiberCell from './FiberCell.svelte';

	let {
		structureName = '',
		portRows = [],
		fiberColors = [],
		loading = false,
		onPortDrop = () => {},
		onClearPort = () => {},
		onClose = () => {}
	} = $props();

	// Color lookup map
	const colorMap = $derived.by(() => {
		const map = new Map();
		for (const color of fiberColors) {
			map.set(color.name_de, color.hex_code);
			map.set(color.name_en, color.hex_code);
		}
		return map;
	});

	function getColorHex(fiberColorName) {
		if (!fiberColorName) return '#999999';
		return colorMap.get(fiberColorName) || '#999999';
	}

	function handlePortDrop(portNumber, side, fiberData) {
		onPortDrop(portNumber, side, fiberData);
	}

	function handleClearPort(portNumber, side) {
		onClearPort(portNumber, side);
	}
</script>

<div
	class="port-table-container h-full flex flex-col rounded-xl border border-surface-200-800 bg-surface-100-900 overflow-hidden"
>
	<!-- Header -->
	<div
		class="flex items-center justify-between px-3 py-2 bg-surface-200-800 border-b border-surface-200-800"
	>
		<div class="flex items-center gap-3">
			<div>
				<h4 class="font-semibold text-sm leading-tight">{structureName}</h4>
				<p class="text-[11px] leading-tight text-surface-500">
					{portRows.length}
					{m.form_ports?.() || 'Ports'}
				</p>
			</div>
		</div>
		<button
			type="button"
			class="p-2 rounded-lg hover:bg-surface-300-700 transition-colors"
			onclick={onClose}
			aria-label={m.common_close?.() || 'Close'}
		>
			<IconX size={18} />
		</button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-8">
			<span class="text-surface-500">{m.common_loading()}</span>
		</div>
	{:else if portRows.length === 0}
		<div class="flex items-center justify-center py-8">
			<span class="text-surface-500">
				{m.message_no_ports?.() || 'No ports configured for this component'}
			</span>
		</div>
	{:else}
		<!-- Column Headers (outside scroll container) -->
		<div
			class="grid grid-cols-[60px_1fr_1fr] bg-surface-200-800 border-b border-surface-200-800 text-xs font-semibold uppercase tracking-wide text-surface-500"
		>
			<div class="px-3 py-2.5 text-center">
				{m.form_port?.() || 'Port'}
			</div>
			<div class="px-3 py-2.5 flex items-center gap-2 border-l border-surface-200-800">
				{m.form_fiber_a?.() || 'Faser A'}
			</div>
			<div class="px-3 py-2.5 flex items-center gap-2 border-l border-surface-200-800">
				{m.form_fiber_b?.() || 'Faser B'}
			</div>
		</div>

		<!-- Scrollable rows -->
		<div class="flex-1 overflow-y-auto min-h-0">
			{#each portRows as row (row.portNumber)}
				<div
					class="grid grid-cols-[60px_1fr_1fr] border-b border-surface-200-800 last:border-b-0 hover:bg-surface-100-900 transition-colors"
				>
					<!-- Port Number -->
					<div
						class="px-3 py-2.5 text-center font-mono text-sm bg-surface-100-900 border-r border-surface-200-800 flex items-center justify-center"
					>
						{row.portNumber}
					</div>

					<!-- Fiber A Cell (IN) -->
					<FiberCell
						fiber={row.fiberA}
						hasPort={row.hasInPort}
						side="a"
						colorHex={getColorHex(row.fiberA?.fiber_color)}
						onDrop={(data) => handlePortDrop(row.portNumber, 'a', data)}
						onClear={() => handleClearPort(row.portNumber, 'a')}
					/>

					<!-- Fiber B Cell (OUT) -->
					<FiberCell
						fiber={row.fiberB}
						hasPort={row.hasOutPort}
						side="b"
						colorHex={getColorHex(row.fiberB?.fiber_color)}
						onDrop={(data) => handlePortDrop(row.portNumber, 'b', data)}
						onClear={() => handleClearPort(row.portNumber, 'b')}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>
