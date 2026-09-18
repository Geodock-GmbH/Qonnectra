<script lang="ts">
	import type { PipeBranchList } from '$lib/remote/pipe-branch/branch-data';

	import { m } from '$lib/paraglide/messages';

	import VirtualCombobox from '$lib/components/VirtualCombobox.svelte';
	import { getPipeBranches } from '$lib/remote/pipe-branch/branches.remote';

	import { getPipeBranchState } from './PipeBranchState.svelte';

	const branch = getPipeBranchState();

	const NO_BRANCHES: PipeBranchList = { branches: [], configured: false };

	const list = $derived(branch.projectId ? await getPipeBranches(branch.projectId) : NO_BRANCHES);
</script>

{#if !list.configured && list.branches.length > 0}
	<div class="text-sm text-warning-500 bg-warning-500/10 p-2 rounded">
		{m.message_pipe_branch_not_configured()}
	</div>
{/if}

<VirtualCombobox
	data={list.branches}
	value={branch.selectedBranch}
	placeholder={m.placeholder_select_pipe_branch()}
	onValueChange={(e) => branch.pickBranch(e.value)}
/>
