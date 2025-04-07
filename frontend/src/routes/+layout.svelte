<script>
	import '../app.css';
	import AppBar from '../components/AppBar.svelte';
	import Sidebar from '../components/SideBar.svelte';
	let { children } = $props();
</script>

<div class="h-screen flex flex-col">
	<AppBar />
	<div class="flex flex-1">
		<Sidebar />
		<main class="flex-1 p-4">
			{@render children()}
		</main>
	</div>
</div>
