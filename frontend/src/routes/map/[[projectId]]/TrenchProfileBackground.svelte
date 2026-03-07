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

	const grassCount = $derived(Math.floor(width / 18));
	const hatchCount = $derived(Math.floor((height - EXCAVATION_TOP + WALL_WIDTH) / 16) + 2);
	const sandDotRows = 3;
	const sandDotsPerRow = $derived(Math.floor(trenchWidth / 20));
	const rockCount = $derived(Math.floor(trenchWidth / 80));
	const pebbleCount = $derived(Math.floor(trenchWidth / 35));

	function seededRandom(seed) {
		const x = Math.sin(seed * 9999) * 10000;
		return x - Math.floor(x);
	}
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

			<clipPath id="leftWallClip">
				<rect x="0" y={EXCAVATION_TOP} width={WALL_WIDTH} height={height - EXCAVATION_TOP} />
			</clipPath>

			<clipPath id="rightWallClip">
				<rect
					x={width - WALL_WIDTH}
					y={EXCAVATION_TOP}
					width={WALL_WIDTH}
					height={height - EXCAVATION_TOP}
				/>
			</clipPath>

			<filter id="roughEdge" x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
				<feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
			</filter>

			<pattern id="soilTexture" patternUnits="userSpaceOnUse" width="100" height="100">
				{#each Array(12) as _, i}
					<circle
						cx={seededRandom(i * 3) * 100}
						cy={seededRandom(i * 3 + 1) * 100}
						r={1 + seededRandom(i * 3 + 2) * 2}
						fill="#3d3428"
						opacity={0.15 + seededRandom(i * 3 + 3) * 0.1}
					/>
				{/each}
			</pattern>
		</defs>

		<!-- Sky with subtle gradient -->
		<rect x="0" y="0" width={width} height={SURFACE_HEIGHT} fill="url(#skyGradient)" />

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
		<rect
			x="0"
			y={GROUND_TOP}
			width={width}
			height={TOPSOIL_THICKNESS}
			fill="url(#topsoilGradient)"
		/>
		<rect x="0" y={GROUND_TOP} width={width} height={TOPSOIL_THICKNESS} fill="url(#soilTexture)" />

		<!-- Subsoil layer (clay/mineral layer) -->
		<rect
			x="0"
			y={TOPSOIL_BOTTOM}
			width={width}
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

		<!-- Grass blades with variation -->
		{#each Array(grassCount) as _, i}
			{@const baseX = 9 + i * 18}
			{@const heightVar = 4 + seededRandom(i) * 6}
			{@const lean = (seededRandom(i + 100) - 0.5) * 4}
			{@const thickness = 1.5 + seededRandom(i + 200) * 1}
			<line
				x1={baseX}
				y1={GROUND_TOP}
				x2={baseX + lean}
				y2={GROUND_TOP - heightVar}
				stroke="#4a7c3f"
				stroke-width={thickness}
				stroke-linecap="round"
			/>
			{#if seededRandom(i + 300) > 0.6}
				<line
					x1={baseX + 5}
					y1={GROUND_TOP}
					x2={baseX + 5 - lean * 0.5}
					y2={GROUND_TOP - heightVar * 0.7}
					stroke="#5a8f4f"
					stroke-width={thickness * 0.8}
					stroke-linecap="round"
				/>
			{/if}
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

		<!-- Left wall hatching -->
		<g clip-path="url(#leftWallClip)">
			{#each Array(hatchCount) as _, i}
				<line
					x1={-10}
					y1={EXCAVATION_TOP + i * 16 - 10}
					x2={WALL_WIDTH + 10}
					y2={EXCAVATION_TOP + i * 16 + WALL_WIDTH + 10}
					stroke="#4a4038"
					stroke-width="1.5"
					opacity="0.5"
				/>
			{/each}
		</g>

		<!-- Right wall hatching -->
		<g clip-path="url(#rightWallClip)">
			{#each Array(hatchCount) as _, i}
				<line
					x1={width - WALL_WIDTH - 10}
					y1={EXCAVATION_TOP + i * 16 - 10}
					x2={width + 10}
					y2={EXCAVATION_TOP + i * 16 + WALL_WIDTH + 10}
					stroke="#4a4038"
					stroke-width="1.5"
					opacity="0.5"
				/>
			{/each}
		</g>

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

		<!-- Embedded rocks in excavation -->
		{#each Array(rockCount) as _, i}
			{@const rx = trenchLeft + 40 + seededRandom(i * 5) * (trenchWidth - 80)}
			{@const ry = EXCAVATION_TOP + 30 + seededRandom(i * 5 + 1) * (sandTop - EXCAVATION_TOP - 70)}
			{@const rw = 12 + seededRandom(i * 5 + 2) * 20}
			{@const rh = 8 + seededRandom(i * 5 + 3) * 12}
			{@const rotation = seededRandom(i * 5 + 4) * 30 - 15}
			<ellipse
				cx={rx}
				cy={ry}
				rx={rw / 2}
				ry={rh / 2}
				fill="#7a7268"
				transform="rotate({rotation} {rx} {ry})"
				opacity="0.6"
			/>
			<ellipse
				cx={rx - 2}
				cy={ry - 2}
				rx={rw / 2 - 2}
				ry={rh / 2 - 2}
				fill="#8a8278"
				transform="rotate({rotation} {rx} {ry})"
				opacity="0.4"
			/>
		{/each}

		<!-- Excavation floor shadow -->
		<rect x={trenchLeft} y={sandTop - 8} width={trenchWidth} height={8} fill="#4a4440" opacity="0.3" />

		<!-- Sand bed with gradient -->
		<rect x={trenchLeft} y={sandTop} width={trenchWidth} height={SAND_HEIGHT} fill="url(#sandGradient)" />

		<!-- Sand bed top edge highlight -->
		<line
			x1={trenchLeft}
			y1={sandTop}
			x2={trenchRight}
			y2={sandTop}
			stroke="#e0cdb5"
			stroke-width="1.5"
			opacity="0.6"
		/>

		<!-- Sand grain texture -->
		{#each Array(sandDotRows) as _, row}
			{#each Array(sandDotsPerRow) as _, col}
				{@const dotX = trenchLeft + 10 + col * 20 + seededRandom(row * 100 + col) * 10}
				{@const dotY = sandTop + 12 + row * 14 + seededRandom(row * 100 + col + 50) * 8}
				{@const dotR = 1 + seededRandom(row * 100 + col + 25) * 1.5}
				<circle cx={dotX} cy={dotY} r={dotR} fill="#a89070" opacity={0.3 + seededRandom(row * 100 + col + 75) * 0.2} />
			{/each}
		{/each}

		<!-- Pebbles in sand -->
		{#each Array(pebbleCount) as _, i}
			{@const px = trenchLeft + 25 + seededRandom(i * 7) * (trenchWidth - 50)}
			{@const py = sandTop + 20 + seededRandom(i * 7 + 1) * (SAND_HEIGHT - 30)}
			{@const pr = 2 + seededRandom(i * 7 + 2) * 3}
			<circle cx={px} cy={py} r={pr} fill="#9a8a75" opacity="0.5" />
		{/each}

		<!-- Corner detail: excavation cut marks -->
		<path
			d="M {trenchLeft} {EXCAVATION_TOP}
			   Q {trenchLeft + 8} {EXCAVATION_TOP + 5} {trenchLeft + 12} {EXCAVATION_TOP}"
			fill="none"
			stroke="#5a4f42"
			stroke-width="2"
			opacity="0.4"
		/>
		<path
			d="M {trenchRight} {EXCAVATION_TOP}
			   Q {trenchRight - 8} {EXCAVATION_TOP + 5} {trenchRight - 12} {EXCAVATION_TOP}"
			fill="none"
			stroke="#5a4f42"
			stroke-width="2"
			opacity="0.4"
		/>

		<!-- Subtle ambient shadow at trench bottom corners -->
		<ellipse
			cx={trenchLeft + 30}
			cy={height - 5}
			rx="25"
			ry="8"
			fill="#3d3630"
			opacity="0.2"
		/>
		<ellipse
			cx={trenchRight - 30}
			cy={height - 5}
			rx="25"
			ry="8"
			fill="#3d3630"
			opacity="0.2"
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
