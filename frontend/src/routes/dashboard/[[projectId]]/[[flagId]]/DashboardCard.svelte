<script>
	let { title, children } = $props();
</script>

<div class="card border-2 border-surface-200-800 shadow-lg overflow-hidden">
	<!-- Title Bar -->
	<div class="border-b-2 border-surface-200-800 p-4">
		<h2 class="h3 font-bold text-primary-500 flex items-center">
			<span>{title}</span>
			<div class="flex-1 h-px bg-primary-500 ml-4"></div>
		</h2>
	</div>

	<div class="p-6">
		{@render children()}
	</div>
</div>
