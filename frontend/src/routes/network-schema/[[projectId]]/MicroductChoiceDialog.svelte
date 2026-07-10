<script>
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	/** @type {{ schemaState: import('$lib/classes/NetworkSchemaState.svelte.js').NetworkSchemaState }} */
	let { schemaState } = $props();

	const current = $derived(schemaState.pendingMicroductChoices[0] ?? null);
</script>

<Dialog
	open={current !== null}
	onOpenChange={(e) => {
		if (!e.open) schemaState.dismissMicroductChoice();
	}}
	closeOnInteractOutside={false}
	closeOnEscape={true}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 backdrop-blur-sm" />

		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
			<Dialog.Content
				class="card bg-surface-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm w-full"
			>
				<Dialog.Title>
					<h3 class="text-lg font-bold">{m.title_micropipe_choice_dialog()}</h3>
				</Dialog.Title>

				{#if current}
					<Dialog.Description>
						<p>
							{m.message_micropipe_choice_dialog({
								address: current.address ?? '',
								cable: current.cableName
							})}
						</p>
					</Dialog.Description>

					<div class="space-y-2 max-h-80 overflow-y-auto">
						{#each current.candidates as candidate (candidate.microduct_uuid)}
							<button
								class="btn preset-outlined w-full flex items-center justify-start gap-3 text-left"
								onclick={() => schemaState.chooseMicroduct(candidate.microduct_uuid)}
							>
								<span
									class="inline-block h-4 w-4 shrink-0 rounded-full border border-surface-400-600"
									style:background-color={candidate.color_hex}
								></span>
								<span class="flex flex-col min-w-0">
									<span class="truncate">
										{candidate.conduit_name} · #{candidate.number}
										{candidate.color}
									</span>
									{#if candidate.linked_cables.length > 0}
										<span class="text-xs opacity-70 truncate">
											{m.label_cables()}: {candidate.linked_cables
												.map((cable) => cable.name)
												.join(', ')}
										</span>
									{/if}
								</span>
							</button>
						{/each}
					</div>
				{/if}

				<footer class="flex gap-2 justify-end">
					<button class="btn preset-filled" onclick={() => schemaState.dismissMicroductChoice()}>
						{m.common_cancel()}
					</button>
				</footer>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
