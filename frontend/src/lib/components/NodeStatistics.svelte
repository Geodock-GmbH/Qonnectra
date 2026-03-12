<script>
	import { m } from '$lib/paraglide/messages';

	import TrenchChart from './Chart.svelte';

	let { nodesByCity, nodesByStatus, nodesByNetworkLevel, nodesByType, nodesByOwner, newestNodes } =
		$props();

	/**
	 * Transform city data for chart
	 * @returns {Array}
	 */
	const cityData = $derived.by(() => {
		return nodesByCity
			?.map((/** @type {{ city: string, count: number }} */ item) => ({
				label: item.city || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform status data for chart
	 * @returns {Array}
	 */
	const statusData = $derived.by(() => {
		return nodesByStatus
			?.map((/** @type {{ status: string, count: number }} */ item) => ({
				label: item.status || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform network level data for chart
	 * @returns {Array}
	 */
	const networkLevelData = $derived.by(() => {
		return nodesByNetworkLevel
			?.map((/** @type {{ network_level: string, count: number }} */ item) => ({
				label: item.network_level || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform node type data for chart
	 * @returns {Array}
	 */
	const typeData = $derived.by(() => {
		return nodesByType
			?.map((/** @type {{ node_type: string, count: number }} */ item) => ({
				label: item.node_type || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform owner data for chart
	 * @returns {Array}
	 */
	const ownerData = $derived.by(() => {
		return nodesByOwner
			?.map((/** @type {{ owner: string, count: number }} */ item) => ({
				label: item.owner || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform newest nodes data for chart (by name and count as 1)
	 * @returns {Array}
	 */
	const newestNodesData = $derived.by(() => {
		return newestNodes?.map((/** @type {{ name: string, node_type: string }} */ item) => ({
			label: `${item.name} (${item.node_type || m.common_unknown()})`,
			value: 1
		}));
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<TrenchChart
			data={cityData}
			title={m.form_nodes_by_city()}
			color="#0ea5e9"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={statusData}
			title={m.form_nodes_by_status()}
			color="#10b981"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={networkLevelData}
			title={m.form_nodes_by_network_level()}
			color="#8b5cf6"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={typeData}
			title={m.form_nodes_by_type()}
			color="#f59e0b"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={ownerData}
			title={m.form_nodes_by_owner()}
			color="#ec4899"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={newestNodesData}
			title={m.form_newest_nodes()}
			color="#14b8a6"
			unit=""
			axisLabel={m.common_count()}
		/>
	</div>
</div>
