<script>
	import '../app.css';
	import AppBar from '../components/AppBar.svelte';
	import Sidebar from '../components/SideBar.svelte';

	let isSidebarExpanded = $state(true);

	function toggleSidebar() {
		isSidebarExpanded = !isSidebarExpanded;
	}

	let { children } = $props();
</script>

<div>
	<AppBar onMenuClick={toggleSidebar} />
	<Sidebar {isSidebarExpanded} />
</div>

{@render children()}
