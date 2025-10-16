import Overlay from 'ol/Overlay';

/**
 * Manages popup overlays on the map
 * Handles creation, positioning, content generation, and lifecycle
 */
export class MapPopupManager {
	overlay = $state(null);
	popupContainer = $state(null);
	contentElement = $state(null);
	closerElement = $state(null);
	alias = $state({});

	/**
	 * @param {Object} alias - Field alias mapping for display names
	 */
	constructor(alias = {}) {
		this.alias = alias;
	}

	/**
	 * Initialize the popup overlay with DOM elements
	 * @param {Object} olMap - OpenLayers map instance
	 * @returns {boolean} True if initialization succeeded
	 */
	initialize(olMap) {
		if (!olMap) {
			console.error('Map instance is required for popup initialization');
			return false;
		}

		// Get DOM elements
		this.popupContainer = document.getElementById('popup');
		this.contentElement = document.getElementById('popup-content');
		this.closerElement = document.getElementById('popup-closer');

		if (!this.popupContainer) {
			console.error('Popup container element not found!');
			return false;
		}

		// Create overlay
		this.overlay = new Overlay({
			element: this.popupContainer,
			autoPan: {
				animation: { duration: 250 }
			}
		});

		olMap.addOverlay(this.overlay);

		// Setup closer button
		if (this.closerElement) {
			this.closerElement.onclick = () => {
				this.hide();
				return false;
			};
		}

		return true;
	}

	/**
	 * Show popup at coordinates with feature properties
	 * @param {Array} coordinate - Map coordinates [x, y]
	 * @param {Object} feature - OpenLayers feature
	 */
	show(coordinate, feature) {
		if (!this.overlay || !this.contentElement) {
			console.warn('Popup not initialized');
			return;
		}

		const properties = feature.getProperties();
		const html = this.generatePopupContent(properties);

		this.contentElement.innerHTML = html;
		this.overlay.setPosition(coordinate);
	}

	/**
	 * Hide the popup
	 */
	hide() {
		if (this.overlay) {
			this.overlay.setPosition(undefined);
		}
		if (this.closerElement) {
			this.closerElement.blur();
		}
	}

	/**
	 * Generate HTML content for popup from feature properties
	 * @param {Object} properties - Feature properties
	 * @returns {string} HTML string
	 */
	generatePopupContent(properties) {
		let html = '<ul>';

		for (const [key, value] of Object.entries(properties)) {
			// Skip geometry and metadata fields
			if (typeof value !== 'object' && key !== 'layer' && key !== 'source') {
				const displayKey = this.alias[key] || key;
				html += `<li><strong>${displayKey}:</strong> ${value}</li>`;
			}
		}

		html += '</ul>';
		return html;
	}

	/**
	 * Update alias mapping
	 * @param {Object} newAlias - New alias mapping
	 */
	updateAlias(newAlias) {
		this.alias = newAlias || {};
	}

	/**
	 * Cleanup method to be called on destroy
	 * @param {Object} olMap - OpenLayers map instance
	 */
	cleanup(olMap) {
		if (olMap && this.overlay) {
			olMap.removeOverlay(this.overlay);
		}
		this.overlay = null;
		this.popupContainer = null;
		this.contentElement = null;
		this.closerElement = null;
	}
}
