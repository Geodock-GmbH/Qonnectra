<script>
	import { onMount } from 'svelte';
	import { ArcElement, Chart, DoughnutController, Legend, Tooltip } from 'chart.js';

	import { m } from '$lib/paraglide/messages';

	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	let { data = [], title = '' } = $props();

	let canvas = $state();
	/** @type {import('chart.js').Chart | null} */
	let chart = null;
	let themeMode = $state('');

	const colors = [
		'#0ea5e9', // sky-500
		'#10b981', // emerald-500
		'#f59e0b', // amber-500
		'#ec4899', // pink-500
		'#8b5cf6', // violet-500
		'#14b8a6', // teal-500
		'#f97316', // orange-500
		'#6366f1', // indigo-500
		'#84cc16', // lime-500
		'#ef4444' // red-500
	];

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
		if (!canvas || !data || data.length === 0 || data.every((item) => !item.value)) return;

		themeMode;

		if (chart) {
			chart.destroy();
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const parentEl = canvas.parentElement;
		if (!parentEl) return;

		const tempElText = document.createElement('div');
		tempElText.style.color = 'var(--preset-filled-surface-900-100)';
		parentEl.appendChild(tempElText);
		const labelColor = getComputedStyle(tempElText).color || '#6b7280';
		parentEl.removeChild(tempElText);

		chart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: data.map((item) => item.label),
				datasets: [
					{
						data: data.map((item) => item.value),
						backgroundColor: colors.slice(0, data.length),
						borderWidth: 0
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
							color: labelColor,
							padding: 12,
							usePointStyle: true,
							font: {
								size: 11
							}
						}
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
								const percentage = ((context.parsed / total) * 100).toFixed(1);
								return `${context.label}: ${context.parsed.toLocaleString('de-DE')}x (${percentage}%)`;
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
