<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	import { onProjectChange, setProjectContext } from '$lib/context/project';
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

	// The project in the URL becomes the remembered project, here and on every
	// later switch within the prefix.
	const remembered = getRememberedProject();
	// svelte-ignore state_referenced_locally
	remembered.set(data.project.id);
	onProjectChange((projectId) => remembered.set(projectId));
</script>

{@render children()}
