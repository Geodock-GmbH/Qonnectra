import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
import type Feature from 'ol/Feature.js';
import type RenderFeature from 'ol/render/Feature.js';
import { createContext } from 'svelte';

import { m } from '$lib/paraglide/messages';

import { LinkedTrenchHighlights } from '$lib/map/linkedTrenchHighlights';
import { selectedConduit } from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';
import { remoteErrorMessage } from '$lib/remote/shared/remote-error';
import { getConduitOptions } from '$lib/remote/trench/conduit-options.remote';
import { createTrenchConnections } from '$lib/remote/trench/connections.remote';
import { calculateRoute } from '$lib/remote/trench/routing.remote';

import { RouteOverlay } from './routeOverlay';

type TrenchSelection = Pick<
	MapSelectionManager,
	'selectFeature' | 'selectMultipleFeatures' | 'clearSelection'
>;

/** A trench hit by a map click. */
export interface PickedTrench {
	uuid: string;
	/** The trench's `id_trench`, which the routing backend addresses trenches by. */
	label: string;
	feature: Feature | RenderFeature;
}

/** How a map click is interpreted, read from the page's stores at click time. */
export interface RoutingOptions {
	/** Whether two picks span a route instead of each pick connecting one trench. */
	enabled: boolean;
	projectId: string;
	/** Snapping tolerance in metres. */
	tolerance: number;
	/** Projection the backend expresses route geometries in. */
	dataProjection: string;
}

/**
 * Interaction state of the trench route: the conduit trenches are assigned
 * to, the route being picked on the map and the overlays mirroring both.
 */
export class TrenchAssignmentState {
	conduitUuid = $state<string | undefined>();
	isCalculatingRoute = $state(false);

	readonly routeOverlay = new RouteOverlay();
	readonly trenchHighlights = new LinkedTrenchHighlights();

	#selection: TrenchSelection;
	#startTrenchId: string | null = null;
	#endTrenchId: string | null = null;

	/**
	 * @param selection - Selection manager of the page's map.
	 * @param conduitUuid - Conduit restored from the session, if any.
	 */
	constructor(selection: TrenchSelection, conduitUuid?: string) {
		this.#selection = selection;
		this.conduitUuid = conduitUuid;
	}

	/**
	 * Switches the conduit trenches are assigned to and remembers it for the
	 * session. A route in progress belongs to the previous conduit and is dropped.
	 * @param conduitUuid - The picked conduit, or `undefined` to clear the choice.
	 */
	selectConduit(conduitUuid: string | undefined): void {
		this.conduitUuid = conduitUuid;
		selectedConduit.set(conduitUuid);
		this.resetRoute();
	}

	/**
	 * Drops a conduit restored from the session when the project and flag do
	 * not offer it any more.
	 * @param projectId - Current project.
	 * @param flagId - Current flag.
	 */
	async validateConduit(projectId: string | undefined, flagId: string | undefined): Promise<void> {
		const restored = this.conduitUuid;
		if (!restored || !projectId || !flagId) return;

		try {
			const options = await getConduitOptions({ projectId, flagId });
			const isOffered = options.some((option) => option.value === restored);
			if (!isOffered && this.conduitUuid === restored) this.selectConduit(undefined);
		} catch {
			// The conduit picker awaits the same query and reports the failure.
		}
	}

	/** Forgets the route in progress and clears it from the map. */
	resetRoute(): void {
		this.#startTrenchId = null;
		this.#endTrenchId = null;
		this.#selection.clearSelection();
		this.routeOverlay.clear();
	}

	/**
	 * Handles a trench picked on the map: connects it to the conduit, or in
	 * routing mode takes it as the start or end of a route.
	 * @param trench - The trench that was hit.
	 * @param routing - Routing mode and its parameters at click time.
	 */
	async pickTrench(trench: PickedTrench, routing: RoutingOptions): Promise<void> {
		if (this.isCalculatingRoute) return;

		if (this.conduitUuid === undefined) {
			globalToaster.error({
				title: m.title_no_conduit_selected(),
				description: m.message_no_conduit_selected_description()
			});
			return;
		}

		if (!routing.enabled) {
			this.#selection.selectFeature(trench.uuid, trench.feature);
			await this.assignTrenches([trench.uuid]);
			return;
		}

		if (this.#startTrenchId && this.#endTrenchId) this.resetRoute();

		if (!this.#startTrenchId) {
			this.#startTrenchId = trench.label;
			this.#selection.selectFeature(trench.uuid, trench.feature);
			return;
		}

		if (trench.label === this.#startTrenchId) return;

		this.#endTrenchId = trench.label;
		this.#selection.selectFeature(trench.uuid, trench.feature);
		await this.#assignRoute(this.#startTrenchId, trench.label, routing);
	}

	/**
	 * Connects the conduit to trenches it does not run through yet. The
	 * command refreshes the conduit's connection list in the same flight.
	 * @param trenchUuids - Trenches picked on the map or traversed by a route.
	 */
	async assignTrenches(trenchUuids: string[]): Promise<void> {
		const conduitUuid = this.conduitUuid;
		if (!conduitUuid || trenchUuids.length === 0) return;

		try {
			const { created } = await createTrenchConnections({ conduitUuid, trenchUuids });
			if (created === 0) {
				globalToaster.warning({ description: m.message_no_new_trench_connections() });
			} else {
				globalToaster.success({ description: m.message_trench_connection_saved() });
			}
		} catch (err) {
			this.#report('Error saving trench connections', 'assignTrenches', err);
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_error_saving_data()
			});
		}
	}

	/** Removes the overlays from the map. */
	cleanup(): void {
		this.routeOverlay.detach();
		this.trenchHighlights.detach();
	}

	async #assignRoute(
		startTrenchId: string,
		endTrenchId: string,
		routing: RoutingOptions
	): Promise<void> {
		this.isCalculatingRoute = true;
		try {
			const route = await calculateRoute({
				startTrenchId,
				endTrenchId,
				projectId: routing.projectId,
				tolerance: routing.tolerance
			});
			const trenchUuids = route.trenches.map((trench) => trench.uuid);

			this.routeOverlay.showRoute(route.pathWkt, routing.dataProjection);
			this.#selection.selectMultipleFeatures(trenchUuids);
			await this.assignTrenches(trenchUuids);
		} catch (err) {
			this.#report('Routing error', 'pickTrench', err);
			globalToaster.error({
				title: m.title_error_calculating_route(),
				description: remoteErrorMessage(err) ?? m.message_error_calculating_route_description()
			});
			this.resetRoute();
		} finally {
			this.isCalculatingRoute = false;
		}
	}

	#report(message: string, from: string, err: unknown): void {
		void logToBackendClient({
			level: 'ERROR',
			message,
			extraData: {
				from: `TrenchAssignmentState.${from}`,
				error: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined
			}
		});
	}
}

export const [getTrenchAssignment, setTrenchAssignment] = createContext<TrenchAssignmentState>();
