<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	import { selectedProject } from '$lib/stores/store';
	import { setProjectContext } from '$lib/context/project';
	import { getRememberedProject } from '$lib/context/rememberedProject.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	setProjectContext({
		get id() {
			return data.project.id;
		},
		get label() {
			return data.project.label;
		}
	});

	const remembered = getRememberedProject();

	/**
	 * The single URL → state bridge: the project in the URL becomes the
	 * remembered project, and fills the legacy `selectedProject` store for the
	 * components that still read it (retired in ticket 06).
	 */
	function adoptProject() {
		remembered.set(data.project.id);
		selectedProject.set(data.project.id);
	}

	adoptProject();
	afterNavigate(({ from, to }) => {
		if (from?.params?.projectId !== to?.params?.projectId) adoptProject();
	});
</script>

{@render children()}
