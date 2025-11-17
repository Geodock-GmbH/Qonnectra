<script>
	import { onMount } from 'svelte';
	import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

	import { m } from '$lib/paraglide/messages';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

	let { data = [], title = '', color = '#0ea5e9', unit = 'km' } = $props();

	let canvas = $state();
	let chart;

	onMount(() => {
		return () => {
			if (chart) {
				chart.destroy();
			}
		};
	});

	$effect(() => {
		if (!canvas || !data || data.length === 0) return;

		if (chart) {
			chart.destroy();
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

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
							}
						},
						grid: {
							display: false,
							color: 'var(--preset-filled-surface-100-900)'
						},
						ticks: {
							callback: function (value) {
								return value.toLocaleString('de-DE');
							}
						}
					},
					y: {
						grid: {
							display: false,
							color: 'var(--preset-filled-surface-100-900)'
						},
						ticks: {
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

<div
	class="card preset-filled-surface-100-900 border border-surface-200-800 shadow-lg overflow-hidden"
>
	<!-- Title Bar -->
	<div class="border-b border-surface-300-700 p-4">
		<h3 class="h4 font-bold text-primary-900-100 flex items-center">
			<span>{title}</span>
			<div class="flex-1 h-px bg-primary-900-100 ml-4"></div>
		</h3>
	</div>

	<!-- Chart Container -->
	<div class="p-6">
		<div class="relative" style="height: 300px;">
			<canvas bind:this={canvas}></canvas>
		</div>
	</div>
</div>
