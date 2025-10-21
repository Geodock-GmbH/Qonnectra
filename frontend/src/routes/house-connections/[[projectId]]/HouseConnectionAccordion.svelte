<script>
	import { deserialize } from '$app/forms';
	import { m } from '$lib/paraglide/messages';
	import { drawerStore } from '$lib/stores/drawer';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconMinus, IconPlus } from '@tabler/icons-svelte';
	import MicroductsTable from './MicroductsTable.svelte';

	let featureId = $derived($drawerStore.props?.featureId);
	let pipesInTrench = $state([]);
	let loading = $state(false);
	let error = $state(null);

	// State for microducts per pipe
	let microducts = $state({});
	let loadingMicroducts = $state({});
	let errorMicroducts = $state({});

	/**
	 * Fetch the pipes in the trench
	 * @returns {Promise<void>}
	 * @throws {Error} If the fetch fails
	 */
	async function fetchPipesInTrench() {
		if (!featureId) return;

		loading = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('uuid', featureId);

			const response = await fetch('?/getPipesInTrench', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				error = result.data?.error || 'Failed to fetch pipes';
				pipesInTrench = [];
				return;
			}

			if (result.type === 'error') {
				error = result.error?.message || 'An error occurred';
				pipesInTrench = [];
				return;
			}

			if (result.type === 'success' && result.data) {
				pipesInTrench = result.data.map((item) => ({
					id: item.uuid || item.id,
					title: item.conduit?.name || `Conduit ${item.uuid?.substring(0, 8)}`,
					description: '',
					data: item,
					pipeUuid: item.conduit?.uuid || null
				}));
			}
		} catch (err) {
			console.error('Error fetching pipes in trench:', err);
			error = 'Failed to load pipes';
			pipesInTrench = [];
		} finally {
			loading = false;
		}
	}

	/**
	 * Fetch microducts for a specific pipe
	 * @param {string} pipeUuid - The UUID of the pipe
	 * @returns {Promise<void>}
	 */
	async function fetchMicroducts(pipeUuid) {
		if (!pipeUuid) return;

		// If already loaded, don't fetch again
		if (microducts[pipeUuid]) return;

		// Set loading state for this pipe - create new object to trigger reactivity
		loadingMicroducts = { ...loadingMicroducts, [pipeUuid]: true };

		try {
			const formData = new FormData();
			formData.append('uuid', pipeUuid);

			const response = await fetch('?/getMicroducts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				errorMicroducts = {
					...errorMicroducts,
					[pipeUuid]: result.data?.error || 'Failed to fetch microducts'
				};
				microducts = { ...microducts, [pipeUuid]: [] };
				return;
			}

			if (result.type === 'error') {
				errorMicroducts = {
					...errorMicroducts,
					[pipeUuid]: result.error?.message || 'An error occurred'
				};
				microducts = { ...microducts, [pipeUuid]: [] };
				return;
			}

			if (result.type === 'success' && result.data) {
				microducts = { ...microducts, [pipeUuid]: result.data };
			}
		} catch (err) {
			console.error('Error fetching microducts:', err);
			errorMicroducts = { ...errorMicroducts, [pipeUuid]: 'Failed to load microducts' };
			microducts = { ...microducts, [pipeUuid]: [] };
		} finally {
			loadingMicroducts = { ...loadingMicroducts, [pipeUuid]: false };
		}
	}

	$effect(() => {
		if (featureId) {
			fetchPipesInTrench();
		}
	});
</script>

{#if loading}
	<div class="placeholder animate-pulse min-h-6">
		<div class="placeholder animate-pulse"></div>
	</div>
{:else if error}
	<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
		<p>{error}</p>
	</div>
{:else if pipesInTrench.length === 0}
	<div class="border rounded-lg p-4">
		<p>{m.message_no_conduits_found()}</p>
	</div>
{:else}
	<Accordion>
		{#each pipesInTrench as item (item.id)}
			<Accordion.Item value={item.id}>
				<Accordion.ItemTrigger
					class="flex justify-between items-center"
					onclick={() => fetchMicroducts(item.pipeUuid)}
				>
					{item.title}
					<Accordion.ItemIndicator class="group">
						<IconMinus class="size-4 group-data-[state=open]:block hidden" />
						<IconPlus class="size-4 group-data-[state=open]:hidden block" />
					</Accordion.ItemIndicator>
				</Accordion.ItemTrigger>
				<Accordion.ItemContent>
					<div class="space-y-2">
						<MicroductsTable
							microducts={microducts[item.pipeUuid] || []}
							loading={loadingMicroducts[item.pipeUuid] || false}
							error={errorMicroducts[item.pipeUuid] || null}
						/>
					</div>
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
