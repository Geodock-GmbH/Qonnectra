import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Manages real-time node position updates via long-polling
 * Handles connection lifecycle and automatic reconnection
 */
export class PositionUpdateManager {
	active = $state(false);
	controller = $state(null);
	projectId = $state(null);
	onUpdate = $state(null);

	constructor() {}

	/**
	 * Start long-polling for position updates
	 * @param {string} projectId - Project UUID to listen for updates
	 * @param {Function} onUpdate - Callback function to handle position updates
	 */
	async start(projectId, onUpdate) {
		this.active = true;
		this.projectId = projectId;
		this.onUpdate = onUpdate;
		this.controller = new AbortController();

		try {
			while (this.active && !this.controller.signal.aborted) {
				const response = await fetch(
					`${PUBLIC_API_URL}node-position-listen/?project=${this.projectId}&timeout=30`,
					{
						signal: this.controller.signal,
						credentials: 'include'
					}
				);

				if (!response.ok) {
					console.warn('Position update request failed:', response.status);
					await new Promise((resolve) => setTimeout(resolve, 5000));
					continue;
				}

				const data = await response.json();

				if (data.updates && data.updates.length > 0 && this.onUpdate) {
					this.onUpdate(data.updates);
				}
			}
		} catch (error) {
			if (error.name !== 'AbortError') {
				console.error('Position update error:', error);
				if (this.active) {
					setTimeout(() => this.start(this.projectId, this.onUpdate), 5000);
				}
			}
		}
	}

	/**
	 * Stop long-polling and cleanup resources
	 */
	stop() {
		this.active = false;
		if (this.controller) {
			this.controller.abort();
			this.controller = null;
		}
	}

	/**
	 * Toggle position updates on/off
	 * @param {string} projectId - Project UUID
	 * @param {Function} onUpdate - Callback for updates
	 */
	toggle(projectId, onUpdate) {
		if (this.active) {
			this.stop();
		} else {
			this.start(projectId, onUpdate);
		}
	}
}
