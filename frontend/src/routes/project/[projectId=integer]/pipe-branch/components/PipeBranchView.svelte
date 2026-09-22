<script lang="ts">
	import type { PipeBranchNodeRef } from './savedCanvas';
	import { error } from '@sveltejs/kit';

	import { m } from '$lib/paraglide/messages';

	import { getPipeBranches } from '$lib/remote/pipe-branch/branches.remote';

	import PipeBranchCanvas from './PipeBranchCanvas.svelte';

	let {
		projectId,
		nodeUuid = null
	}: {
		projectId: string;
		/** The node named in the URL, or null on the page without one. */
		nodeUuid?: string | null;
	} = $props();

	/**
	 * Resolves the node named in the URL through the branch list, which the
	 * picker shares, to the name the backend resolves trenches by. An unknown
	 * uuid fails the boundary, never a blank canvas.
	 * @param uuid - The node uuid from the URL.
	 */
	async function resolveNode(uuid: string): Promise<PipeBranchNodeRef> {
		const list = await getPipeBranches(projectId);
		const match = list.branches.find((candidate) => candidate.uuid === uuid);
		if (!match) error(404, m.message_pipe_branch_not_found());
		return { uuid: match.uuid, name: match.label };
	}

	const node = $derived(nodeUuid ? await resolveNode(nodeUuid) : null);
</script>

{#key nodeUuid}
	<PipeBranchCanvas {projectId} {node} />
{/key}
