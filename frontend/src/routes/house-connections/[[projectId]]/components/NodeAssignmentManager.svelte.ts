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
 * Manages node assignment mode for microducts
 * Coordinates with MapInteractionManager to enable node-only clicking
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
	 * @param interactionManager - MapInteractionManager instance
	 */
	constructor(interactionManager: InteractionManagerRef) {
		this.interactionManager = interactionManager;
		this.originalClickHandler = this.interactionManager.handleFeatureClick.bind(
			this.interactionManager
		);
	}

	/**
	 * Activate node assignment mode
	 * @param microductUuid - UUID of the microduct to assign a node to
	 * @param conduitUuid - UUID of the conduit the microduct belongs to
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
	 * Deactivate node assignment mode and restore original state
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
	 * Create a custom click handler for assign mode
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
	 * @param feature - The clicked feature
	 * @param isNode - Whether the feature belongs to the node layer
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
	 * Restore the original click handler
	 */
	restoreOriginalClickHandler(): void {
		if (this.originalClickHandler && this.interactionManager) {
			this.interactionManager.handleFeatureClick = this.originalClickHandler;
		}
	}

	/**
	 * Assign a node to the active microduct and leave assign mode on success.
	 * @param nodeUuid - UUID of the node to assign
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
	 * Log a failed assignment and tell the user why it failed.
	 * @param err - The rejection value of the assign command
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
	 * Cleanup method to be called on destroy
	 */
	cleanup(): void {
		if (this.isAssignMode) {
			this.deactivateAssignMode();
		}
	}
}
