<script>
	let { width = 800, height = 600 } = $props();
</script>

<svg
	class="trench-background"
	viewBox="0 0 {width} {height}"
	preserveAspectRatio="xMidYMid meet"
>
	<!-- Ground surface layer -->
	<rect x="0" y="0" width={width} height="60" fill="var(--color-surface-400)" />

	<!-- Surface grass/texture pattern -->
	<line
		x1="0"
		y1="58"
		x2={width}
		y2="58"
		stroke="var(--color-surface-500)"
		stroke-width="2"
	/>

	<!-- Trench cut (trapezoidal shape) -->
	<path
		d="M 50 60 L 100 {height - 80} L {width - 100} {height - 80} L {width - 50} 60 Z"
		fill="var(--color-surface-600)"
		stroke="var(--color-surface-700)"
		stroke-width="2"
	/>

	<!-- Left trench wall hatching -->
	{#each Array(Math.floor((height - 140) / 20)) as _, i}
		<line
			x1={55 + (i * 50) / (height - 140) * 2}
			y1={60 + i * 20}
			x2={65 + (i * 50) / (height - 140) * 2}
			y2={70 + i * 20}
			stroke="var(--color-surface-500)"
			stroke-width="1"
			opacity="0.5"
		/>
	{/each}

	<!-- Right trench wall hatching -->
	{#each Array(Math.floor((height - 140) / 20)) as _, i}
		<line
			x1={width - 55 - (i * 50) / (height - 140) * 2}
			y1={60 + i * 20}
			x2={width - 65 - (i * 50) / (height - 140) * 2}
			y2={70 + i * 20}
			stroke="var(--color-surface-500)"
			stroke-width="1"
			opacity="0.5"
		/>
	{/each}

	<!-- Sand bed at bottom -->
	<rect x="100" y={height - 80} width={width - 200} height="40" fill="#d4b76a" opacity="0.7" />

	<!-- Sand texture dots -->
	{#each Array(20) as _, i}
		<circle
			cx={120 + i * ((width - 240) / 20)}
			cy={height - 60}
			r="2"
			fill="var(--color-surface-500)"
			opacity="0.3"
		/>
	{/each}

	<!-- Trench floor line (dashed) -->
	<line
		x1="100"
		y1={height - 40}
		x2={width - 100}
		y2={height - 40}
		stroke="var(--color-surface-800)"
		stroke-width="1"
		stroke-dasharray="8,4"
	/>

	<!-- Dimension line indicators (optional visual cue) -->
	<line
		x1="30"
		y1="60"
		x2="30"
		y2={height - 40}
		stroke="var(--color-surface-500)"
		stroke-width="1"
		stroke-dasharray="4,4"
		opacity="0.5"
	/>
</svg>

<style>
	.trench-background {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}
</style>
