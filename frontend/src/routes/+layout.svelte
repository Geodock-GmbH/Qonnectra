<script>
	import '../app.css';
	import AppBar from '../components/AppBar.svelte';
	import Sidebar from '../components/SideBar.svelte';
	let { children } = $props();
</script>

<div class="flex flex-col relative">
	<AppBar />
	<div class="h-screen flex flex-1 absolute top-0">
		<Sidebar />
		<main class="flex-1 p-4 mt-16">
			{@render children()}
		</main>
	</div>
</div>
