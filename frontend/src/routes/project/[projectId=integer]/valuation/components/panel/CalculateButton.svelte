<script lang="ts">
	import { IconCalculator } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';
	import {
		calculateValuation,
		getValuationRateCount
	} from '$lib/remote/valuation/valuation.remote';

	import { getValuationState } from '../ValuationState.svelte';

	const valuation = getValuationState();

	let isCalculating = $state(false);

	const rateCount = $derived(await getValuationRateCount({ projectId: valuation.projectId }));

	/**
	 * Calculates the valuation of the current selection and hands it to the shared
	 * state, unless the page was reset for another project scope in the meantime.
	 */
	async function calculate(): Promise<void> {
		if (!valuation.selectionValid || isCalculating) return;
		isCalculating = true;
		const { resetCount } = valuation;

		try {
			const result = await calculateValuation({
				projectId: valuation.projectId,
				areaUuids: valuation.areaUuids
			});
			if (resetCount === valuation.resetCount) valuation.result = result;
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.valuation_result_failed()
			});
		} finally {
			isCalculating = false;
		}
	}
</script>

{#if rateCount === 0}
	<p class="text-xs text-warning-600 mb-2">{m.valuation_no_rates()}</p>
{/if}
<button
	type="button"
	class="btn preset-filled-primary-500 w-full"
	disabled={!valuation.selectionValid || isCalculating || rateCount === 0}
	onclick={calculate}
>
	<IconCalculator class="size-4" />
	<span>{isCalculating ? m.valuation_calculating() : m.valuation_calculate()}</span>
</button>
{#if !valuation.selectionValid}
	<p class="text-xs text-surface-500 mt-2">{m.valuation_select_area_hint()}</p>
{/if}
