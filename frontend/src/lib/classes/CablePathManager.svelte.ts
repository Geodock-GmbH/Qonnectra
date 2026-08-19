import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';

/**
 * Manages cable path geometry and handle configuration
 * Handles both temporary updates during editing and persistence to backend
 */
export class CablePathManager {
	constructor() {}

	/**
	 * Update cable path geometry
	 * @param edgeId - Edge UUID
	 * @param waypoints - Array of {x, y} waypoint coordinates
	 * @param temporary - Whether this is a temporary update (during drag)
	 * @param save - Whether to save to backend
	 * @param updateCallback - Callback to update edge in state
	 */
	async updatePath(
		edgeId: string,
		waypoints: { x: number; y: number }[],
		temporary: boolean,
		save: boolean,
		updateCallback: (edgeId: string, update: Record<string, unknown>) => void
	): Promise<void> {
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
				void logToBackendClient({
					level: 'ERROR',
					message: 'Error saving cable path',
					extraData: {
						from: 'CablePathManager.updatePath',
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined
					}
				});
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable_path()
				});
			}
		}
	}

	/**
	 * Update cable handle configuration
	 * @param cableId - Cable UUID
	 * @param handleStart - Start handle position
	 * @param handleEnd - End handle position
	 * @param updateCallback - Callback to update handles in state
	 */
	updateHandles(
		cableId: string,
		handleStart: string,
		handleEnd: string,
		updateCallback: (cableId: string, handleStart: string, handleEnd: string) => void
	): void {
		if (updateCallback) {
			updateCallback(cableId, handleStart, handleEnd);
		}
	}
}
