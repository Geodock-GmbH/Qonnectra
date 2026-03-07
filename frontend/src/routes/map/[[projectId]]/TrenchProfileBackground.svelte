<script>
	let { width = 1200, height = 800 } = $props();
</script>

<div
	class="trench-background-container"
	style:width="{width}px"
	style:height="{height}px"
	style:transform="translate(-100px, -100px)"
>
	<svg viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet">
		<!-- Sky/air above ground -->
		<rect x="0" y="0" width={width} height="80" fill="var(--color-surface-100)" />

		<!-- Ground surface layer -->
		<rect x="0" y="80" width={width} height="40" fill="var(--color-surface-400)" />

		<!-- Surface line -->
		<line x1="0" y1="78" x2={width} y2="78" stroke="var(--color-surface-500)" stroke-width="2" />

		<!-- Grass texture -->
		{#each Array(Math.floor(width / 30)) as _, i}
			<line
				x1={15 + i * 30}
				y1="80"
				x2={15 + i * 30}
				y2="75"
				stroke="var(--color-success-600)"
				stroke-width="2"
			/>
		{/each}

		<!-- Trench excavation (trapezoidal) -->
		<path
			d="M 80 120 L 140 {height - 100} L {width - 140} {height - 100} L {width - 80} 120 Z"
			fill="var(--color-surface-500)"
			stroke="var(--color-surface-600)"
			stroke-width="2"
		/>

		<!-- Soil layers within trench walls -->
		<rect x="0" y="120" width="80" height={height - 220} fill="var(--color-surface-400)" />
		<rect
			x={width - 80}
			y="120"
			width="80"
			height={height - 220}
			fill="var(--color-surface-400)"
		/>

		<!-- Left trench wall hatching -->
		{#each Array(Math.floor((height - 220) / 25)) as _, i}
			<line
				x1="82"
				y1={130 + i * 25}
				x2="92"
				y2={140 + i * 25}
				stroke="var(--color-surface-600)"
				stroke-width="1.5"
			/>
		{/each}

		<!-- Right trench wall hatching -->
		{#each Array(Math.floor((height - 220) / 25)) as _, i}
			<line
				x1={width - 82}
				y1={130 + i * 25}
				x2={width - 92}
				y2={140 + i * 25}
				stroke="var(--color-surface-600)"
				stroke-width="1.5"
			/>
		{/each}

		<!-- Sand bed at bottom -->
		<rect
			x="140"
			y={height - 100}
			width={width - 280}
			height="50"
			fill="#d4b896"
			stroke="#b8a07a"
			stroke-width="1"
		/>

		<!-- Sand texture pattern -->
		{#each Array(Math.floor((width - 280) / 20)) as _, i}
			<circle
				cx={160 + i * 20}
				cy={height - 75}
				r="2"
				fill="var(--color-surface-500)"
				opacity="0.4"
			/>
		{/each}

		<!-- Trench floor dashed line -->
		<line
			x1="140"
			y1={height - 50}
			x2={width - 140}
			y2={height - 50}
			stroke="var(--color-surface-700)"
			stroke-width="1"
			stroke-dasharray="10,5"
		/>

		<!-- Dimension indicator left -->
		<line
			x1="50"
			y1="120"
			x2="50"
			y2={height - 50}
			stroke="var(--color-surface-400)"
			stroke-width="1"
			stroke-dasharray="4,4"
		/>

		<!-- Bottom soil layer -->
		<rect x="0" y={height - 100} width="140" height="100" fill="var(--color-surface-400)" />
		<rect
			x={width - 140}
			y={height - 100}
			width="140"
			height="100"
			fill="var(--color-surface-400)"
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
