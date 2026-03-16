<script>
	let { title, children } = $props();
</script>

<div class="card border border-surface-200-800 overflow-hidden">
	<div class="border-b border-surface-200-800 px-4 py-3">
		<h2 class="font-semibold text-surface-900-100 flex items-center gap-3">
			<span>{title}</span>
			<div class="flex-1 h-px bg-surface-200-800"></div>
		</h2>
	</div>

	<div class="p-4">
		{@render children()}
	</div>
</div>
