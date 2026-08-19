import type { Feature } from 'ol';
import type LayerBase from 'ol/layer/Layer';
import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';

interface SelectableLayersConfig {
	trench: boolean;
	address: boolean;
	node: boolean;
	area?: boolean;
}

interface InteractionManagerRef {
	olMap: import('ol/Map').default | null;
	layers: { nodeLayer?: LayerBase | null };
	selectableLayersConfig: SelectableLayersConfig;
	handleFeatureClick: (feature: Feature, coordinate: number[], layer?: LayerBase | null) => void;
}

/**
 * Manages node assignment mode for microducts
 * Coordinates with MapInteractionManager to enable node-only clicking
 */
export class NodeAssignmentManager {
	isAssignMode: boolean = $state(false);

	activeMicroductUuid: string | null = $state(null);

	interactionManager: InteractionManagerRef | null = $state(null);

	originalSelectableConfig: SelectableLayersConfig | null = $state(null);

	originalClickHandler:
		| ((feature: Feature, coordinate: number[], layer?: LayerBase | null) => void)
		| null = $state(null);

	onAssignmentComplete: ((data: unknown) => void) | null = $state(null);

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
	 * @param onComplete - Callback function to execute after successful assignment
	 */
	activateAssignMode(
		microductUuid: string,
		onComplete: ((data: unknown) => void) | null = null
	): void {
		if (!microductUuid || !this.interactionManager) {
			console.error('Microduct UUID is required to activate assign mode');
			return;
		}

		this.originalSelectableConfig = { ...this.interactionManager.selectableLayersConfig };

		this.interactionManager.selectableLayersConfig = {
			trench: false,
			address: false,
			node: true
		};

		this.isAssignMode = true;
		this.activeMicroductUuid = microductUuid;
		this.onAssignmentComplete = onComplete;

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
		this.onAssignmentComplete = null;

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
	createAssignModeClickHandler(): (
		feature: Feature,
		coordinate: number[],
		layer?: LayerBase | null
	) => Promise<void> {
		const manager = this.interactionManager as InteractionManagerRef;
		const originalHandler = manager.handleFeatureClick.bind(manager);

		return async (feature: Feature, coordinate: number[], layer: LayerBase | null = null) => {
			if (!this.isAssignMode) {
				return originalHandler(feature, coordinate, layer);
			}

			const featureId = feature.getId();
			if (!featureId) {
				return;
			}

			const { nodeLayer } = manager.layers;
			if (layer !== nodeLayer) {
				return;
			}

			const properties = feature.getProperties();
			const nodeUuid = properties.uuid || featureId;

			if (!properties.address) {
				globalToaster.info({
					title: m.common_info(),
					description: m.message_info_node_has_no_address_assigned()
				});
				return;
			}

			await this.assignNodeToMicroduct(nodeUuid as string);
		};
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
	 * Assign a node to the active microduct
	 * @param nodeUuid - UUID of the node to assign
	 */
	async assignNodeToMicroduct(nodeUuid: string): Promise<void> {
		if (!this.activeMicroductUuid || !nodeUuid) {
			console.error('Missing microduct or node UUID');
			return;
		}

		try {
			const formData = new FormData();
			formData.append('microductUuid', this.activeMicroductUuid);
			formData.append('nodeUuid', nodeUuid);

			const response = await fetch('?/assignNodeToMicroduct', {
				method: 'POST',
				body: formData
			});

			const textResponse = await response.text();
			const result = deserialize(textResponse);

			if (result.type === 'success') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_assigned_node()
				});

				if (this.onAssignmentComplete) {
					this.onAssignmentComplete(result.data);
				}

				this.deactivateAssignMode();
			} else if (result.type === 'failure') {
				const errorMessage = (result.data as { error?: string })?.error || 'Failed to assign node';
				globalToaster.error({
					title: m.common_error(),
					description: errorMessage
				});
			} else if (result.type === 'error') {
				const errorMessage = result.error?.message || 'An error occurred';
				globalToaster.error({
					title: m.common_error(),
					description: errorMessage
				});
			}
		} catch (error: unknown) {
			console.error('Error assigning node to microduct:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error assigning node to microduct',
				extraData: {
					from: 'NodeAssignmentManager.assignNodeToMicroduct',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: (error as Error).message
			});
		}
	}

	/**
	 * Remove a node from a microduct (unassign)
	 * @param microductUuid - UUID of the microduct to remove the node from
	 * @param onComplete - Callback function to execute after successful removal
	 */
	async removeNodeFromMicroduct(
		microductUuid: string,
		onComplete: ((data: unknown) => void) | null = null
	): Promise<void> {
		if (!microductUuid) {
			console.error('Microduct UUID is required');
			return;
		}

		try {
			const formData = new FormData();
			formData.append('microductUuid', microductUuid);

			const response = await fetch('?/removeNodeFromMicroduct', {
				method: 'POST',
				body: formData
			});

			const textResponse = await response.text();
			const result = deserialize(textResponse);

			if (result.type === 'success') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_unassigned_node()
				});

				if (onComplete) {
					onComplete(result.data);
				}
			} else if (result.type === 'failure') {
				const errorMessage = (result.data as { error?: string })?.error || 'Failed to remove node';
				globalToaster.error({
					title: m.common_error(),
					description: errorMessage
				});
			} else if (result.type === 'error') {
				const errorMessage = result.error?.message || 'An error occurred';
				globalToaster.error({
					title: m.common_error(),
					description: errorMessage
				});
			}
		} catch (error: unknown) {
			console.error('Error removing node from microduct:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error removing node from microduct',
				extraData: {
					from: 'NodeAssignmentManager.removeNodeFromMicroduct',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: (error as Error).message
			});
		}
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
