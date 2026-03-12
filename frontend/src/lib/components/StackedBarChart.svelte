<script>
	import { onMount } from 'svelte';
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

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	/**
	 * @typedef {Object} Dataset
	 * @property {string} label - The label for this dataset
	 * @property {number[]} data - The data values
	 * @property {string} backgroundColor - The background color
	 */

	/**
	 * @typedef {Object} ChartData
	 * @property {string[]} labels - The x-axis labels
	 * @property {Dataset[]} datasets - The datasets to display
	 */

	let { data = /** @type {ChartData} */ ({ labels: [], datasets: [] }), title = '', unit = 'km' } = $props();

	let canvas = $state();
	/** @type {import('chart.js').Chart | null} */
	let chart = null;
	let themeMode = $state('');

	onMount(() => {
		const observer = new MutationObserver(() => {
			themeMode = document.documentElement.getAttribute('data-mode') || '';
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-mode']
		});

		themeMode = document.documentElement.getAttribute('data-mode') || '';

		return () => {
			observer.disconnect();
			if (chart) {
				chart.destroy();
			}
		};
	});

	$effect(() => {
		if (!canvas || !data || !data.labels || data.labels.length === 0) return;

		themeMode;

		if (chart) {
			chart.destroy();
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const parentEl = canvas.parentElement;
		if (!parentEl) return;

		const tempElBorder = document.createElement('div');
		tempElBorder.style.borderColor = 'var(--preset-filled-surface-200-800)';
		parentEl.appendChild(tempElBorder);
		const axisBorderColor = getComputedStyle(tempElBorder).borderColor || '#9ca3af';
		parentEl.removeChild(tempElBorder);

		const tempElText = document.createElement('div');
		tempElText.style.color = 'var(--preset-filled-surface-900-100)';
		parentEl.appendChild(tempElText);
		const axisTextColor = getComputedStyle(tempElText).color || '#6b7280';
		parentEl.removeChild(tempElText);

		chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.labels,
				datasets: data.datasets.map((/** @type {Dataset} */ ds) => ({
					label: ds.label,
					data: ds.data,
					backgroundColor: ds.backgroundColor,
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
							color: axisTextColor,
							usePointStyle: true,
							font: {
								size: 11
							}
						}
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								return (
									context.dataset.label +
									': ' +
									(context.parsed.x ?? 0).toLocaleString('de-DE', {
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
						stacked: true,
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
							display: false
						},
						ticks: {
							color: axisTextColor,
							callback: function (value) {
								return value.toLocaleString('de-DE');
							}
						}
					},
					y: {
						stacked: true,
						border: {
							color: axisBorderColor
						},
						grid: {
							display: false
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
	<div class="border-b-2 border-surface-200-800 p-4">
		<h3 class="h4 font-bold text-primary-500 flex items-center">
			<span>{title}</span>
			<div class="flex-1 h-px bg-primary-500 ml-4"></div>
		</h3>
	</div>

	<div class="p-6">
		<div class="relative" style="height: 300px;">
			{#if !data || !data.labels || data.labels.length === 0}
				<div class="flex items-center justify-center h-full text-surface-500">
					{m.form_no_data_available()}
				</div>
			{:else}
				<canvas bind:this={canvas}></canvas>
			{/if}
		</div>
	</div>
</div>
