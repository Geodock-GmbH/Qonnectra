<script lang="ts">
	import { ArcElement, Chart, DoughnutController, Legend, Tooltip } from 'chart.js';

	import { m } from '$lib/paraglide/messages';

	import { readChartTheme } from '$lib/utils/chartTheme';

	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	interface ChartDatum {
		label: string;
		value: number;
	}

	interface Props {
		data?: ChartDatum[];
		title?: string;
	}

	let { data = [], title = '' }: Props = $props();

	const isEmpty = $derived(data.length === 0 || data.every((item) => !item.value));

	/**
	 * Draws the donut chart onto the canvas. Re-runs when the data or the
	 * theme change; the returned cleanup destroys the previous instance.
	 */
	function donutChart(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		const host = canvas.parentElement;
		if (!ctx || !host) return;

		const theme = readChartTheme(host);

		const chart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: data.map((item) => item.label),
				datasets: [
					{
						data: data.map((item) => item.value),
						backgroundColor: theme.shades(data.length),
						borderColor: theme.segmentBorder,
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1.8,
				cutout: '50%',
				plugins: {
					legend: {
						position: 'right',
						labels: {
							color: theme.text,
							padding: 12,
							usePointStyle: true,
							font: {
								size: 11
							}
						}
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
								const percentage = ((context.parsed / total) * 100).toFixed(1);
								return `${context.label}: ${context.parsed.toLocaleString('de-DE')}x (${percentage}%)`;
							}
						}
					}
				}
			}
		});

		return () => chart.destroy();
	}
</script>

<div class="card border border-surface-200-800 overflow-hidden">
	<div class="border-b border-surface-200-800 px-4 py-3">
		<h3 class="font-semibold text-surface-900-100 flex items-center gap-3">
			<span>{title}</span>
			<div class="flex-1 h-px bg-surface-200-800"></div>
		</h3>
	</div>

	<div class="p-4">
		<div class="relative" style="height: 300px;">
			{#if isEmpty}
				<div class="flex items-center justify-center h-full text-surface-500">
					{m.form_no_data_available()}
				</div>
			{:else}
				<canvas {@attach donutChart}></canvas>
			{/if}
		</div>
	</div>
</div>
