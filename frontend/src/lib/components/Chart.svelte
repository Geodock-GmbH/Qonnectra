<script lang="ts">
	import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

	import { m } from '$lib/paraglide/messages';

	import { readChartTheme } from '$lib/utils/chartTheme';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

	interface ChartDatum {
		label: string;
		value: number;
	}

	interface Props {
		data?: ChartDatum[];
		title?: string;
		unit?: string;
		/** Optional x-axis label; if not set, uses Length (unit) for length data. */
		axisLabel?: string;
	}

	let { data = [], title = '', unit = 'km', axisLabel }: Props = $props();

	const isEmpty = $derived(data.length === 0 || data.every((item) => !item.value));

	/**
	 * Draws the bar chart onto the canvas. Re-runs when the data, labels or
	 * the theme change; the returned cleanup destroys the previous instance.
	 */
	function barChart(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		const host = canvas.parentElement;
		if (!ctx || !host) return;

		const theme = readChartTheme(host);

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.map((item) => item.label),
				datasets: [
					{
						data: data.map((item) => item.value),
						backgroundColor: theme.series,
						borderColor: theme.series,
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
							label: (context) =>
								`${(context.parsed.x ?? 0).toLocaleString('de-DE', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})} ${unit}`
						}
					}
				},
				scales: {
					x: {
						beginAtZero: true,
						title: {
							display: true,
							text: axisLabel ?? `${m.common_length()} (${unit})`,
							font: {
								size: 12,
								weight: 'bold'
							},
							color: theme.text
						},
						border: {
							color: theme.axisBorder
						},
						grid: {
							display: false
						},
						ticks: {
							color: theme.text,
							callback: (value) => Number(value).toLocaleString('de-DE')
						}
					},
					y: {
						border: {
							color: theme.axisBorder
						},
						grid: {
							display: false
						},
						ticks: {
							color: theme.text,
							font: {
								size: 11
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
				<canvas {@attach barChart}></canvas>
			{/if}
		</div>
	</div>
</div>
