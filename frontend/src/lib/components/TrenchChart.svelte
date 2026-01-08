<script>
	import { onMount } from 'svelte';
	import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

	import { m } from '$lib/paraglide/messages';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

	let { data = [], title = '', color = '#0ea5e9', unit = 'km' } = $props();

	let canvas = $state();
	let chart;
	let themeMode = $state('');

	onMount(() => {
		// Watch for theme changes by observing data-mode attribute
		const observer = new MutationObserver(() => {
			themeMode = document.documentElement.getAttribute('data-mode') || '';
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-mode']
		});

		// Set initial theme mode
		themeMode = document.documentElement.getAttribute('data-mode') || '';

		return () => {
			observer.disconnect();
			if (chart) {
				chart.destroy();
			}
		};
	});

	$effect(() => {
		if (!canvas || !data || data.length === 0 || data.every((item) => !item.value)) return;

		// Re-render chart when theme changes (themeMode is a dependency)
		themeMode;

		if (chart) {
			chart.destroy();
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Resolve CSS variables for axis colors using the canvas parent for proper context
		const parentEl = canvas.parentElement;
		if (!parentEl) return;

		// Resolve border color
		const tempElBorder = document.createElement('div');
		tempElBorder.style.borderColor = 'var(--preset-filled-surface-200-800)';
		parentEl.appendChild(tempElBorder);
		const axisBorderColor = getComputedStyle(tempElBorder).borderColor || '#9ca3af';
		parentEl.removeChild(tempElBorder);

		// Resolve tick/label text color
		const tempElText = document.createElement('div');
		tempElText.style.color = 'var(--preset-filled-surface-900-100)';
		parentEl.appendChild(tempElText);
		const axisTextColor = getComputedStyle(tempElText).color || '#6b7280';
		parentEl.removeChild(tempElText);

		chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.map((item) => item.label),
				datasets: [
					{
						data: data.map((item) => item.value),
						backgroundColor: color,
						borderColor: color,
						borderWidth: 0,
						borderRadius: 4
					}
				]
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1.8,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								return (
									context.parsed.x.toLocaleString('de-DE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									}) +
									' ' +
									unit
								);
							}
						}
					}
				},
				scales: {
					x: {
						beginAtZero: true,
						title: {
							display: true,
							text: m.common_length() + ' (' + unit + ')',
							font: {
								size: 12,
								weight: 'bold'
							},
							color: axisTextColor
						},
						border: {
							color: axisBorderColor
						},
						grid: {
							display: false,
							color: 'var(--preset-filled-surface-100-900)'
						},
						ticks: {
							color: axisTextColor,
							callback: function (value) {
								return value.toLocaleString('de-DE');
							}
						}
					},
					y: {
						border: {
							color: axisBorderColor
						},
						grid: {
							display: false,
							color: 'var(--preset-filled-surface-900-100)'
						},
						ticks: {
							color: axisTextColor,
							font: {
								size: 11
							}
						}
					}
				}
			}
		});
	});
</script>

<div class="card border-2 border-surface-200-800 shadow-lg overflow-hidden">
	<!-- Title Bar -->
	<div class="border-b-2 border-surface-200-800 p-4">
		<h3 class="h4 font-bold text-primary-500 flex items-center">
			<span>{title}</span>
			<div class="flex-1 h-px bg-primary-500 ml-4"></div>
		</h3>
	</div>

	<!-- Chart Container -->
	<div class="p-6">
		<div class="relative" style="height: 300px;">
			{#if !data || data.length === 0 || data.every((item) => !item.value)}
				<div class="flex items-center justify-center h-full text-surface-500">
					{m.form_no_data_available()}
				</div>
			{:else}
				<canvas bind:this={canvas}></canvas>
			{/if}
		</div>
	</div>
</div>
