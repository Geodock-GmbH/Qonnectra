<script lang="ts">
	import {
		BarController,
		BarElement,
		CategoryScale,
		Chart,
		Legend,
		LinearScale,
		Tooltip
	} from 'chart.js';

	import { m } from '$lib/paraglide/messages';

	import { readChartTheme } from '$lib/utils/chartTheme';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	interface Dataset {
		/** The label for this dataset */
		label: string;
		/** The data values */
		data: number[];
	}

	interface ChartData {
		/** The x-axis labels */
		labels: string[];
		/** The datasets to display */
		datasets: Dataset[];
	}

	interface Props {
		data?: ChartData;
		title?: string;
		unit?: string;
	}

	let { data = { labels: [], datasets: [] }, title = '', unit = 'km' }: Props = $props();

	const isEmpty = $derived(data.labels.length === 0);

	/**
	 * Draws the stacked bar chart onto the canvas. Re-runs when the data or
	 * the theme change; the returned cleanup destroys the previous instance.
	 */
	function stackedBarChart(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		const host = canvas.parentElement;
		if (!ctx || !host) return;

		const theme = readChartTheme(host);
		const shades = theme.shades(data.datasets.length);

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.labels,
				datasets: data.datasets.map((ds, i) => ({
					label: ds.label,
					data: ds.data,
					backgroundColor: shades[i],
					borderWidth: 0,
					borderRadius: 2
				}))
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1.8,
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: {
							color: theme.text,
							usePointStyle: true,
							font: {
								size: 11
							}
						}
					},
					tooltip: {
						callbacks: {
							label: (context) =>
								`${context.dataset.label}: ${(context.parsed.x ?? 0).toLocaleString('de-DE', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})} ${unit}`
						}
					}
				},
				scales: {
					x: {
						stacked: true,
						beginAtZero: true,
						title: {
							display: true,
							text: `${m.common_length()} (${unit})`,
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
						stacked: true,
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
				<canvas {@attach stackedBarChart}></canvas>
			{/if}
		</div>
	</div>
</div>
