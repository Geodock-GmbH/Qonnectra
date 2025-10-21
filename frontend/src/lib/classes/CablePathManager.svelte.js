import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

/**
 * Manages cable path geometry and handle configuration
 * Handles both temporary updates during editing and persistence to backend
 */
export class CablePathManager {
	constructor() {}

	/**
	 * Update cable path geometry
	 * @param {string} edgeId - Edge UUID
	 * @param {Array} waypoints - Array of {x, y} waypoint coordinates
	 * @param {boolean} temporary - Whether this is a temporary update (during drag)
	 * @param {boolean} save - Whether to save to backend
	 * @param {Function} updateCallback - Callback to update edge in state
	 * @returns {Promise<void>}
	 */
	async updatePath(edgeId, waypoints, temporary, save, updateCallback) {
		if (updateCallback) {
			updateCallback(edgeId, {
				data: {
					cable: {
						diagram_path: waypoints
					}
				}
			});
		}

		if (save) {
			try {
				const formData = new FormData();
				formData.append('cableId', edgeId);
				formData.append('diagram_path', JSON.stringify(waypoints));

				const response = await fetch('?/saveCableGeometry', {
					method: 'POST',
					body: formData
				});

				const result = await response.json();

				if (!response.ok || result.type === 'error') {
					throw new Error(result.message || 'Failed to save cable path');
				}

				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_updating_cable_path()
				});
			} catch (error) {
				console.error('Error saving cable path:', error);
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable_path()
				});
			}
		}
	}

	/**
	 * Update cable handle configuration
	 * @param {string} cableId - Cable UUID
	 * @param {string} handleStart - Start handle position
	 * @param {string} handleEnd - End handle position
	 * @param {Function} updateCallback - Callback to update handles in state
	 */
	updateHandles(cableId, handleStart, handleEnd, updateCallback) {
		if (updateCallback) {
			updateCallback(cableId, handleStart, handleEnd);
		}
	}
}
