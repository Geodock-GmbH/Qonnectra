import type { Feature } from 'ol';
import type LayerBase from 'ol/layer/Layer';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';
import { assignNodeToMicroduct } from '$lib/remote/house-connections/node-assignment.remote';
import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

interface SelectableLayersConfig {
	trench: boolean;
	address: boolean;
	node: boolean;
	area?: boolean;
}

type FeatureClickHandler = (
	feature: Feature,
	coordinate: number[],
	layer?: LayerBase | null
) => void | Promise<void>;

interface InteractionManagerRef {
	olMap: import('ol/Map').default | null;
	layers: { nodeLayer?: LayerBase | null };
	selectableLayersConfig: SelectableLayersConfig;
	handleFeatureClick: FeatureClickHandler;
}

/**
 * Drives the "pick a node on the map to assign to this microduct" mode. While
 * active it narrows the interaction manager to node-only clicking and swaps in
 * a click handler that routes node clicks to the assignment command, restoring
 * the previous selection config and handler when the mode ends.
 */
export class NodeAssignmentManager {
	isAssignMode: boolean = $state(false);

	activeMicroductUuid: string | null = $state(null);

	/** Conduit of the active microduct; its microduct list is refreshed by the assignment. */
	activeConduitUuid: string | null = null;

	interactionManager: InteractionManagerRef | null = null;

	originalSelectableConfig: SelectableLayersConfig | null = null;

	originalClickHandler: FeatureClickHandler | null = null;

	escapeKeyHandler: ((event: KeyboardEvent) => void) | null = null;

	/**
	 * @param interactionManager - Map interaction manager whose selectable
	 * layers and click handler this manager takes over while assigning.
	 */
	constructor(interactionManager: InteractionManagerRef) {
		this.interactionManager = interactionManager;
		this.originalClickHandler = this.interactionManager.handleFeatureClick.bind(
			this.interactionManager
		);
	}

	/**
	 * Enters assign mode: restricts map clicks to nodes, sets a crosshair cursor,
	 * binds Escape to cancel, and installs the assign-mode click handler. No-op
	 * when either UUID is missing or the interaction manager is unavailable.
	 * @param microductUuid - UUID of the microduct to assign a node to.
	 * @param conduitUuid - UUID of the conduit the microduct belongs to.
	 * @returns Nothing.
	 */
	activateAssignMode(microductUuid: string, conduitUuid: string): void {
		if (!microductUuid || !conduitUuid || !this.interactionManager) return;

		this.originalSelectableConfig = { ...this.interactionManager.selectableLayersConfig };

		this.interactionManager.selectableLayersConfig = {
			trench: false,
			address: false,
			node: true
		};

		this.isAssignMode = true;
		this.activeMicroductUuid = microductUuid;
		this.activeConduitUuid = conduitUuid;

		if (this.interactionManager.olMap) {
			const viewport = this.interactionManager.olMap.getTargetElement();
			if (viewport) {
				(viewport as HTMLElement).style.cursor = 'crosshair';
			}
		}

		this.escapeKeyHandler = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && this.isAssignMode) {
				this.deactivateAssignMode();
			}
		};
		document.addEventListener('keydown', this.escapeKeyHandler);

		this.interactionManager.handleFeatureClick = this.createAssignModeClickHandler();
	}

	/**
	 * Leaves assign mode and restores the selectable-layers config, cursor,
	 * Escape binding and click handler captured on activation.
	 * @returns Nothing.
	 */
	deactivateAssignMode(): void {
		if (this.originalSelectableConfig && this.interactionManager) {
			this.interactionManager.selectableLayersConfig = { ...this.originalSelectableConfig };
		}

		this.isAssignMode = false;
		this.activeMicroductUuid = null;
		this.activeConduitUuid = null;

		if (this.escapeKeyHandler) {
			document.removeEventListener('keydown', this.escapeKeyHandler);
			this.escapeKeyHandler = null;
		}

		if (this.interactionManager?.olMap) {
			const viewport = this.interactionManager.olMap.getTargetElement();
			if (viewport) {
				(viewport as HTMLElement).style.cursor = '';
			}
		}

		this.restoreOriginalClickHandler();
	}

	/**
	 * Builds the click handler used while assigning: node clicks drive the
	 * assignment, and any click received after the mode was left falls through
	 * to the manager's original handler.
	 * @returns The assign-mode feature click handler.
	 */
	createAssignModeClickHandler(): FeatureClickHandler {
		const manager = this.interactionManager as InteractionManagerRef;
		const originalHandler = manager.handleFeatureClick.bind(manager);

		return (feature, coordinate, layer = null) => {
			if (!this.isAssignMode) return originalHandler(feature, coordinate, layer);
			return this.handleAssignModeClick(feature, layer === manager.layers.nodeLayer);
		};
	}

	/**
	 * Assign the clicked node to the active microduct; clicks on anything but an
	 * addressed node are ignored.
	 * @param feature - The clicked feature.
	 * @param isNode - Whether the feature belongs to the node layer.
	 * @returns Resolves once the assignment attempt (if any) has settled.
	 */
	async handleAssignModeClick(feature: Feature, isNode: boolean): Promise<void> {
		const featureId = feature.getId();
		if (!featureId || !isNode) return;

		const properties = feature.getProperties();
		if (!properties.address) {
			globalToaster.info({
				title: m.common_info(),
				description: m.message_info_node_has_no_address_assigned()
			});
			return;
		}

		await this.assignNodeToMicroduct(String(properties.uuid || featureId));
	}

	/**
	 * Restores the interaction manager's click handler captured on construction.
	 * @returns Nothing.
	 */
	restoreOriginalClickHandler(): void {
		if (this.originalClickHandler && this.interactionManager) {
			this.interactionManager.handleFeatureClick = this.originalClickHandler;
		}
	}

	/**
	 * Assigns a node to the active microduct and leaves assign mode on success;
	 * failures are reported and the mode stays active. No-op when no microduct is
	 * active or `nodeUuid` is empty.
	 * @param nodeUuid - UUID of the node to assign.
	 * @returns Resolves once the assignment attempt has settled.
	 */
	async assignNodeToMicroduct(nodeUuid: string): Promise<void> {
		if (!this.activeMicroductUuid || !this.activeConduitUuid || !nodeUuid) return;

		try {
			await assignNodeToMicroduct({
				microductUuid: this.activeMicroductUuid,
				conduitUuid: this.activeConduitUuid,
				nodeUuid
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_assigned_node()
			});
			this.deactivateAssignMode();
		} catch (err) {
			this.reportAssignmentFailure(err);
		}
	}

	/**
	 * Logs a failed assignment to the backend and shows the user why it failed.
	 * @param err - The rejection value of the assign command.
	 * @returns Nothing.
	 */
	reportAssignmentFailure(err: unknown): void {
		void logToBackendClient({
			level: 'ERROR',
			message: 'Error assigning node to microduct',
			extraData: {
				from: 'NodeAssignmentManager.assignNodeToMicroduct',
				error: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined
			}
		});
		globalToaster.error({
			title: m.common_error(),
			description: remoteErrorMessage(err) ?? m.message_error_saving_data()
		});
	}

	/**
	 * Tears the manager down on component destroy, leaving assign mode if it is
	 * still active so global listeners and cursor state are released.
	 * @returns Nothing.
	 */
	cleanup(): void {
		if (this.isAssignMode) {
			this.deactivateAssignMode();
		}
	}
}
