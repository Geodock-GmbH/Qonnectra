<script>
	let { width = 1200, height = 800 } = $props();

	const SURFACE_HEIGHT = 80;
	const TOPSOIL_THICKNESS = 25;
	const SUBSOIL_THICKNESS = 35;
	const SAND_HEIGHT = 50;
	const WALL_WIDTH = 60;

	const GROUND_TOP = SURFACE_HEIGHT;
	const TOPSOIL_BOTTOM = GROUND_TOP + TOPSOIL_THICKNESS;
	const EXCAVATION_TOP = GROUND_TOP + TOPSOIL_THICKNESS + SUBSOIL_THICKNESS;
	const sandTop = $derived(height - SAND_HEIGHT);

	const trenchLeft = WALL_WIDTH;
	const trenchRight = $derived(width - WALL_WIDTH);
	const trenchWidth = $derived(width - 2 * WALL_WIDTH);
</script>

<div
	class="trench-background-container"
	style:width="{width}px"
	style:height="{height}px"
	style:transform="translate(-100px, -100px)"
>
	<svg viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet">
		<defs>
			<linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
				<stop offset="0%" stop-color="#e8eff5" />
				<stop offset="100%" stop-color="#d4dfe8" />
			</linearGradient>

			<linearGradient id="topsoilGradient" x1="0%" y1="0%" x2="0%" y2="100%">
				<stop offset="0%" stop-color="#5d4a3c" />
				<stop offset="100%" stop-color="#4a3d32" />
			</linearGradient>

			<linearGradient id="subsoilGradient" x1="0%" y1="0%" x2="0%" y2="100%">
				<stop offset="0%" stop-color="#7a6b5a" />
				<stop offset="100%" stop-color="#6b5d4d" />
			</linearGradient>

			<linearGradient id="excavationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
				<stop offset="0%" stop-color="#6b635b" />
				<stop offset="40%" stop-color="#5e574f" />
				<stop offset="100%" stop-color="#524b44" />
			</linearGradient>

			<linearGradient id="sandGradient" x1="0%" y1="0%" x2="0%" y2="100%">
				<stop offset="0%" stop-color="#d4b896" />
				<stop offset="50%" stop-color="#c9ad8a" />
				<stop offset="100%" stop-color="#bfa07e" />
			</linearGradient>

			<linearGradient id="wallGradientLeft" x1="100%" y1="0%" x2="0%" y2="0%">
				<stop offset="0%" stop-color="#6b5d4d" />
				<stop offset="100%" stop-color="#5a4f42" />
			</linearGradient>

			<linearGradient id="wallGradientRight" x1="0%" y1="0%" x2="100%" y2="0%">
				<stop offset="0%" stop-color="#6b5d4d" />
				<stop offset="100%" stop-color="#5a4f42" />
			</linearGradient>
		</defs>

		<!-- Sky with subtle gradient -->
		<rect x="0" y="0" {width} height={SURFACE_HEIGHT} fill="url(#skyGradient)" />

		<!-- Horizon haze line -->
		<line
			x1="0"
			y1={SURFACE_HEIGHT - 1}
			x2={width}
			y2={SURFACE_HEIGHT - 1}
			stroke="#b8c4cf"
			stroke-width="1"
			opacity="0.6"
		/>

		<!-- Topsoil layer (dark organic soil) -->
		<rect x="0" y={GROUND_TOP} {width} height={TOPSOIL_THICKNESS} fill="url(#topsoilGradient)" />

		<!-- Subsoil layer (clay/mineral layer) -->
		<rect
			x="0"
			y={TOPSOIL_BOTTOM}
			{width}
			height={SUBSOIL_THICKNESS}
			fill="url(#subsoilGradient)"
		/>

		<!-- Layer separation line -->
		<line
			x1="0"
			y1={TOPSOIL_BOTTOM}
			x2={width}
			y2={TOPSOIL_BOTTOM}
			stroke="#3d3428"
			stroke-width="1"
			opacity="0.4"
			stroke-dasharray="8 4"
		/>

		<!-- Surface vegetation (subtle tick marks) -->
		{#each Array(Math.floor(width / 12)) as _, i}
			<line
				x1={6 + i * 12}
				y1={GROUND_TOP}
				x2={6 + i * 12}
				y2={GROUND_TOP - 3}
				stroke="#5a6b52"
				stroke-width="1"
				opacity="0.5"
			/>
		{/each}

		<!-- Left soil wall -->
		<rect
			x="0"
			y={EXCAVATION_TOP}
			width={WALL_WIDTH}
			height={height - EXCAVATION_TOP}
			fill="url(#wallGradientLeft)"
		/>

		<!-- Right soil wall -->
		<rect
			x={width - WALL_WIDTH}
			y={EXCAVATION_TOP}
			width={WALL_WIDTH}
			height={height - EXCAVATION_TOP}
			fill="url(#wallGradientRight)"
		/>

		<!-- Wall edge shadow (left) -->
		<line
			x1={trenchLeft}
			y1={EXCAVATION_TOP}
			x2={trenchLeft}
			y2={height}
			stroke="#3d3630"
			stroke-width="3"
			opacity="0.4"
		/>

		<!-- Wall edge highlight (left inner) -->
		<line
			x1={trenchLeft + 2}
			y1={EXCAVATION_TOP}
			x2={trenchLeft + 2}
			y2={height}
			stroke="#8a7d6d"
			stroke-width="1"
			opacity="0.3"
		/>

		<!-- Wall edge shadow (right) -->
		<line
			x1={trenchRight}
			y1={EXCAVATION_TOP}
			x2={trenchRight}
			y2={height}
			stroke="#3d3630"
			stroke-width="3"
			opacity="0.4"
		/>

		<!-- Wall edge highlight (right inner) -->
		<line
			x1={trenchRight - 2}
			y1={EXCAVATION_TOP}
			x2={trenchRight - 2}
			y2={height}
			stroke="#8a7d6d"
			stroke-width="1"
			opacity="0.3"
		/>

		<!-- Main excavation area with gradient -->
		<rect
			x={trenchLeft}
			y={EXCAVATION_TOP}
			width={trenchWidth}
			height={sandTop - EXCAVATION_TOP}
			fill="url(#excavationGradient)"
		/>

		<!-- Sand bed with gradient -->
		<rect
			x={trenchLeft}
			y={sandTop}
			width={trenchWidth}
			height={SAND_HEIGHT}
			fill="url(#sandGradient)"
		/>

		<!-- Sand bed top border line -->
		<line
			x1={trenchLeft}
			y1={sandTop}
			x2={trenchRight}
			y2={sandTop}
			stroke="#b8a07a"
			stroke-width="1"
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
