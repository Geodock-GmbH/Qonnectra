<script>
	let { width = 1200, height = 800 } = $props();

	const SURFACE_HEIGHT = 80;
	const GROUND_THICKNESS = 40;
	const SAND_HEIGHT = 50;
	const WALL_WIDTH = 60;
</script>

<div
	class="trench-background-container"
	style:width="{width}px"
	style:height="{height}px"
	style:transform="translate(-100px, -100px)"
>
	<svg viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet">
		<!-- Sky/air above ground -->
		<rect x="0" y="0" width={width} height={SURFACE_HEIGHT} fill="var(--color-surface-100)" />

		<!-- Ground surface layer -->
		<rect
			x="0"
			y={SURFACE_HEIGHT}
			width={width}
			height={GROUND_THICKNESS}
			fill="var(--color-surface-400)"
		/>

		<!-- Surface line -->
		<line
			x1="0"
			y1={SURFACE_HEIGHT - 2}
			x2={width}
			y2={SURFACE_HEIGHT - 2}
			stroke="var(--color-surface-500)"
			stroke-width="2"
		/>

		<!-- Grass texture -->
		{#each Array(Math.floor(width / 30)) as _, i}
			<line
				x1={15 + i * 30}
				y1={SURFACE_HEIGHT}
				x2={15 + i * 30}
				y2={SURFACE_HEIGHT - 5}
				stroke="var(--color-success-600)"
				stroke-width="2"
			/>
		{/each}

		<!-- Left soil wall -->
		<rect
			x="0"
			y={SURFACE_HEIGHT + GROUND_THICKNESS}
			width={WALL_WIDTH}
			height={height - SURFACE_HEIGHT - GROUND_THICKNESS}
			fill="var(--color-surface-400)"
		/>

		<!-- Right soil wall -->
		<rect
			x={width - WALL_WIDTH}
			y={SURFACE_HEIGHT + GROUND_THICKNESS}
			width={WALL_WIDTH}
			height={height - SURFACE_HEIGHT - GROUND_THICKNESS}
			fill="var(--color-surface-400)"
		/>

		<!-- Main trench excavation area (earth/brown tone) -->
		<rect
			x={WALL_WIDTH}
			y={SURFACE_HEIGHT + GROUND_THICKNESS}
			width={width - 2 * WALL_WIDTH}
			height={height - SURFACE_HEIGHT - GROUND_THICKNESS - SAND_HEIGHT}
			fill="#78716c"
		/>

		<!-- Sand bed - full width of trench floor -->
		<rect
			x={WALL_WIDTH}
			y={height - SAND_HEIGHT}
			width={width - 2 * WALL_WIDTH}
			height={SAND_HEIGHT}
			fill="#d4b896"
		/>

		<!-- Sand bed top border -->
		<line
			x1={WALL_WIDTH}
			y1={height - SAND_HEIGHT}
			x2={width - WALL_WIDTH}
			y2={height - SAND_HEIGHT}
			stroke="#b8a07a"
			stroke-width="2"
		/>

		<!-- Sand texture pattern -->
		{#each Array(Math.floor((width - 2 * WALL_WIDTH) / 25)) as _, i}
			<circle
				cx={WALL_WIDTH + 12 + i * 25}
				cy={height - SAND_HEIGHT / 2}
				r="2"
				fill="var(--color-surface-500)"
				opacity="0.3"
			/>
		{/each}

		<!-- Left wall hatching -->
		{#each Array(Math.floor((height - SURFACE_HEIGHT - GROUND_THICKNESS) / 35)) as _, i}
			<line
				x1={WALL_WIDTH - 30}
				y1={SURFACE_HEIGHT + GROUND_THICKNESS + 20 + i * 35}
				x2={WALL_WIDTH - 18}
				y2={SURFACE_HEIGHT + GROUND_THICKNESS + 32 + i * 35}
				stroke="var(--color-surface-500)"
				stroke-width="1.5"
			/>
		{/each}

		<!-- Right wall hatching -->
		{#each Array(Math.floor((height - SURFACE_HEIGHT - GROUND_THICKNESS) / 35)) as _, i}
			<line
				x1={width - WALL_WIDTH + 30}
				y1={SURFACE_HEIGHT + GROUND_THICKNESS + 20 + i * 35}
				x2={width - WALL_WIDTH + 18}
				y2={SURFACE_HEIGHT + GROUND_THICKNESS + 32 + i * 35}
				stroke="var(--color-surface-500)"
				stroke-width="1.5"
			/>
		{/each}

		<!-- Vertical wall edge lines -->
		<line
			x1={WALL_WIDTH}
			y1={SURFACE_HEIGHT + GROUND_THICKNESS}
			x2={WALL_WIDTH}
			y2={height}
			stroke="var(--color-surface-600)"
			stroke-width="2"
		/>
		<line
			x1={width - WALL_WIDTH}
			y1={SURFACE_HEIGHT + GROUND_THICKNESS}
			x2={width - WALL_WIDTH}
			y2={height}
			stroke="var(--color-surface-600)"
			stroke-width="2"
		/>
	</svg>
</div>

<style>
	.trench-background-container {
		position: absolute;
		pointer-events: none;
		z-index: -1;
	}

	svg {
		width: 100%;
		height: 100%;
	}
</style>
