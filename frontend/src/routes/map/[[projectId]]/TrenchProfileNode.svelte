<script>
	import { NodeResizer } from '@xyflow/svelte';

	import { tooltip } from '$lib/utils/tooltip.js';

	let { data, selected } = $props();

	const microducts = $derived(data?.conduit?.microducts || []);
	const microductCount = $derived(microducts.length);

	/**
	 * Calculate microduct positions in a circular or grid layout
	 * @returns {Array} Array of position objects with x, y, and mic data
	 */
	const microductPositions = $derived.by(() => {
		if (microductCount === 0) return [];

		const positions = [];
		const centerX = 50;
		const centerY = 50;

		if (microductCount <= 6) {
			// Circular layout for small counts
			const radius = microductCount <= 3 ? 15 : 20;
			for (let i = 0; i < microductCount; i++) {
				const angle = (i / microductCount) * 2 * Math.PI - Math.PI / 2;
				const x = centerX + radius * Math.cos(angle);
				const y = centerY + radius * Math.sin(angle);
				positions.push({ x, y, mic: microducts[i] });
			}
		} else {
			// Grid layout for larger counts
			const cols = Math.ceil(Math.sqrt(microductCount));
			const rows = Math.ceil(microductCount / cols);

			// Calculate radius based on count
			const radius = microductCount <= 12 ? 5 : microductCount <= 20 ? 4 : 3;

			// Available space inside the pipe - inner radius is 38, need margin for microduct radius
			const innerRadius = 38 - radius - 4;
			const gridSize = innerRadius * 1.4; // Use ~70% of diameter for square grid in circle

			const spacingX = cols > 1 ? gridSize / (cols - 1) : 0;
			const spacingY = rows > 1 ? gridSize / (rows - 1) : 0;
			const startX = centerX - gridSize / 2;
			const startY = centerY - gridSize / 2;

			for (let i = 0; i < microductCount; i++) {
				const row = Math.floor(i / cols);
				const col = i % cols;
				positions.push({
					x: cols === 1 ? centerX : startX + col * spacingX,
					y: rows === 1 ? centerY : startY + row * spacingY,
					mic: microducts[i]
				});
			}
		}

		return positions;
	});

	const microductRadius = $derived(
		microductCount <= 6 ? 6 : microductCount <= 12 ? 5 : microductCount <= 20 ? 4 : 3
	);

	const tooltipContent = $derived(
		`${data?.conduit?.conduit_name || 'Unknown'} - ${data?.conduit?.conduit_type || 'No type'}`
	);
</script>

<NodeResizer minWidth={40} minHeight={40} maxWidth={200} maxHeight={200} isVisible={selected} />

<div
	class="trench-profile-node"
	class:selected
	{@attach tooltip(tooltipContent, { position: 'top', delay: 300 })}
>
	<svg viewBox="0 0 100 100" class="pipe-cross-section">
		<defs>
			<!-- Gradient definitions for two-layer microducts -->
			{#each microductPositions as pos}
				{#if pos.mic.is_two_layer}
					<linearGradient id="gradient-{pos.mic.uuid}" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="50%" stop-color={pos.mic.hex_code} />
						<stop offset="50%" stop-color={pos.mic.hex_code_secondary} />
					</linearGradient>
				{/if}
			{/each}
		</defs>

		<!-- Pipe wall (outer circle with fixed stroke width) -->
		<circle
			cx="50"
			cy="50"
			r="45"
			fill="var(--color-surface-300)"
			stroke="var(--color-surface-600)"
			stroke-width="4"
		/>

		<!-- Inner hollow area -->
		<circle cx="50" cy="50" r="38" fill="var(--color-surface-100)" />

		<!-- Microducts inside the pipe -->
		{#each microductPositions as pos}
			<circle
				cx={pos.x}
				cy={pos.y}
				r={microductRadius}
				fill={pos.mic.is_two_layer ? `url(#gradient-${pos.mic.uuid})` : pos.mic.hex_code}
				stroke="var(--color-surface-500)"
				stroke-width="0.5"
				opacity={pos.mic.status ? 0.4 : 1}
			/>
			{#if pos.mic.status}
				<!-- Status indicator X for occupied microducts -->
				<text
					x={pos.x}
					y={pos.y + 1}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="6"
					fill="var(--color-surface-900)"
					font-weight="bold">✕</text
				>
			{/if}
		{/each}

		<!-- Pipe wall inner edge highlight -->
		<circle
			cx="50"
			cy="50"
			r="38"
			fill="none"
			stroke="var(--color-surface-400)"
			stroke-width="0.5"
		/>
	</svg>

	<span class="node-label">{data?.conduit?.conduit_name || ''}</span>
</div>

<style>
	.trench-profile-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		cursor: grab;
	}

	.pipe-cross-section {
		width: 85%;
		height: 85%;
		filter: drop-shadow(1px 2px 3px rgba(0, 0, 0, 0.15));
		transition: filter 0.2s ease;
	}

	.trench-profile-node.selected .pipe-cross-section {
		filter: drop-shadow(0 0 6px var(--color-primary-500));
	}

	.trench-profile-node:hover .pipe-cross-section {
		filter: drop-shadow(0 0 4px var(--color-primary-400));
	}

	.node-label {
		font-size: 9px;
		font-weight: 500;
		text-align: center;
		color: var(--color-surface-900);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		margin-top: 2px;
	}
</style>
