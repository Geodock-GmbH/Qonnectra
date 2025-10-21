import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

/**
 * Manages node assignment mode for microducts
 * Coordinates with MapInteractionManager to enable node-only clicking
 */
export class NodeAssignmentManager {
	isAssignMode = $state(false);
	activeMicroductUuid = $state(null);
	interactionManager = $state(null);
	originalSelectableConfig = $state(null);
	originalClickHandler = $state(null);
	onAssignmentComplete = $state(null);
	escapeKeyHandler = null;

	/**
	 * @param {Object} interactionManager - MapInteractionManager instance
	 */
	constructor(interactionManager) {
		this.interactionManager = interactionManager;
		this.originalClickHandler = this.interactionManager.handleFeatureClick.bind(
			this.interactionManager
		);
	}

	/**
	 * Activate node assignment mode
	 * @param {string} microductUuid - UUID of the microduct to assign a node to
	 * @param {Function} onComplete - Callback function to execute after successful assignment
	 */
	activateAssignMode(microductUuid, onComplete = null) {
		if (!microductUuid) {
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
				viewport.style.cursor = 'crosshair';
			}
		}

		this.escapeKeyHandler = (event) => {
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
	deactivateAssignMode() {
		if (this.originalSelectableConfig) {
			this.interactionManager.selectableLayersConfig = { ...this.originalSelectableConfig };
		}

		this.isAssignMode = false;
		this.activeMicroductUuid = null;
		this.onAssignmentComplete = null;

		if (this.escapeKeyHandler) {
			document.removeEventListener('keydown', this.escapeKeyHandler);
			this.escapeKeyHandler = null;
		}

		if (this.interactionManager.olMap) {
			const viewport = this.interactionManager.olMap.getTargetElement();
			if (viewport) {
				viewport.style.cursor = '';
			}
		}

		this.restoreOriginalClickHandler();
	}

	/**
	 * Create a custom click handler for assign mode
	 * @returns {Function} Custom feature click handler
	 */
	createAssignModeClickHandler() {
		const originalHandler = this.interactionManager.handleFeatureClick.bind(
			this.interactionManager
		);

		return async (feature, coordinate, layer = null) => {
			if (!this.isAssignMode) {
				return originalHandler(feature, coordinate, layer);
			}

			const featureId = feature.getId();
			if (!featureId) {
				return;
			}

			const { nodeLayer } = this.interactionManager.layers;
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

			await this.assignNodeToMicroduct(nodeUuid);
		};
	}

	/**
	 * Restore the original click handler
	 */
	restoreOriginalClickHandler() {
		if (this.originalClickHandler) {
			this.interactionManager.handleFeatureClick = this.originalClickHandler;
		}
	}

	/**
	 * Assign a node to the active microduct
	 * @param {string} nodeUuid - UUID of the node to assign
	 */
	async assignNodeToMicroduct(nodeUuid) {
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
				const errorMessage = result.data?.error || 'Failed to assign node';
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
		} catch (error) {
			console.error('Error assigning node to microduct:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message
			});
		}
	}

	/**
	 * Remove a node from a microduct (unassign)
	 * @param {string} microductUuid - UUID of the microduct to remove the node from
	 * @param {Function} onComplete - Callback function to execute after successful removal
	 */
	async removeNodeFromMicroduct(microductUuid, onComplete = null) {
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
				const errorMessage = result.data?.error || 'Failed to remove node';
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
		} catch (error) {
			console.error('Error removing node from microduct:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message
			});
		}
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		if (this.isAssignMode) {
			this.deactivateAssignMode();
		}
	}
}
