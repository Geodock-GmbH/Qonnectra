<script>
	// Skeleton
	import { Modal } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconPlus } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let { projectId, openPipeModal, small = false } = $props();
</script>

<Modal
	open={openPipeModal}
	onOpenChange={(e) => (openPipeModal = e.open)}
	triggerBase={small ? 'btn-icon preset-filled-primary-500' : 'btn preset-filled-primary-500'}
	contentBase="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
	backdropClasses="backdrop-blur-sm"
>
	{#snippet trigger()}
		{#if small}
			<IconPlus size={18} />
		{:else}
			{m.add_conduit()}
		{/if}
	{/snippet}
	{#snippet content()}
		<header class="flex justify-between">
			<h2 class="h3">{m.add_conduit()}</h2>
		</header>
		<form id="pipe-form" class="mx-auto w-full max-w-md space-y-4 grid grid-cols-2 gap-4">
			<label class="label">
				<span class="label-text">{m.name()}</span>
				<input type="text" class="input" placeholder="" name="pipe_name" required />
			</label>
			<label for="pipe_type" class="label">
				<span class="label-text">{m.conduit_type()}</span>
				<select name="pipe_type" class="select" id="pipe_type" required>
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
				</select>
			</label>
			<label class="label">
				<span class="label-text">{m.outer_conduit()}</span>
				<textarea name="outer_conduit" id="outer_conduit" class="textarea" placeholder=""
				></textarea>
			</label>
			<label for="status" class="label">
				<span class="label-text">{m.status()}</span>
				<select name="status" class="select" id="status">
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
				</select>
			</label>
			<label for="network_level" class="label">
				<span class="label-text">{m.network_level()}</span>
				<select name="network_level" class="select" id="network_level">
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
				</select>
			</label>
			<label for="owner" class="label">
				<span class="label-text">{m.owner()}</span>
				<select name="owner" class="select" id="owner">
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
				</select>
			</label>
			<label for="constructor" class="label">
				<span class="label-text">{m.constructor()}</span>
				<select name="constructor" class="select" id="constructor">
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
				</select>
			</label>
			<label for="manufacturer" class="label">
				<span class="label-text">{m.manufacturer()}</span>
				<select name="manufacturer" class="select" id="manufacturer">
					<option value="1">1</option>
					<option value="2">2</option>
				</select>
			</label>
			<label for="date" class="label">
				<span class="label-text">{m.date()}</span>
				<input type="date" name="date" id="date" class="input" />
			</label>
			<label for="flag" class="label">
				<span class="label-text">{m.flag()}</span>
				<select name="flag" class="select" id="flag" required>
					<option value="1">1</option>
					<option value="2">2</option>
				</select>
			</label>
		</form>

		<footer class="flex justify-end gap-4">
			<button type="button" class="btn preset-tonal" onclick={() => (openPipeModal = false)}>
				Cancel
			</button>
			<button type="submit" class="btn preset-filled" form="pipe-form"> Confirm </button>
		</footer>
	{/snippet}
</Modal>
