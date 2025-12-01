<script>
	let { title, children } = $props();
</script>

<div
	class="card preset-filled-surface-100-900 border border-surface-200-800 shadow-lg overflow-hidden"
>
	<!-- Title Bar -->
	<div class="border-b border-surface-300-600 p-4">
		<h2 class="h3 font-bold text-primary-900-100 flex items-center">
			<span>{title}</span>
			<div class="flex-1 h-px bg-primary-900-100 ml-4"></div>
		</h2>
	</div>

	<div class="p-6">
		{@render children()}
	</div>
</div>
