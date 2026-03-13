import Feature from 'ol/Feature';
import OlMap from 'ol/Map';
import Overlay from 'ol/Overlay';

/**
 * @typedef {Record<string, string>} AliasMapping
 */

/**
 * @typedef {Record<string, unknown>} FeatureProperties
 */

/**
 * Manages popup overlays on the map
 * Handles creation, positioning, content generation, and lifecycle
 */
export class MapPopupManager {
	/** @type {Overlay | null} */
	overlay = $state(null);
	/** @type {HTMLElement | null} */
	popupContainer = $state(null);
	/** @type {HTMLElement | null} */
	contentElement = $state(null);
	/** @type {HTMLElement | null} */
	closerElement = $state(null);
	/** @type {AliasMapping} */
	alias = $state({});

	/**
	 * @param {AliasMapping} alias - Field alias mapping for display names
	 */
	constructor(alias = {}) {
		this.alias = alias;
	}

	/**
	 * Initializes the popup overlay by locating DOM elements and attaching to the map.
	 * @param {OlMap} olMap - OpenLayers map instance
	 * @returns {boolean} True if initialization succeeded
	 */
	initialize(olMap) {
		if (!olMap) {
			console.error('Map instance is required for popup initialization');
			return false;
		}

		this.popupContainer = document.getElementById('popup');
		this.contentElement = document.getElementById('popup-content');
		this.closerElement = document.getElementById('popup-closer');

		if (!this.popupContainer) {
			console.error('Popup container element not found!');
			return false;
		}

		this.overlay = new Overlay({
			element: this.popupContainer,
			autoPan: {
				animation: { duration: 250 }
			}
		});

		olMap.addOverlay(this.overlay);

		if (this.closerElement) {
			this.closerElement.onclick = () => {
				this.hide();
				return false;
			};
		}

		return true;
	}

	/**
	 * Displays the popup at the given coordinates with the feature's properties.
	 * @param {number[]} coordinate - Map coordinates [x, y]
	 * @param {Feature | import('ol/render/Feature').default} feature - OpenLayers feature
	 * @returns {void}
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
	 * Hides the popup and removes focus from the closer button.
	 * @returns {void}
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
	 * Generates an HTML list of feature properties, skipping geometry and metadata fields.
	 * @param {FeatureProperties} properties - Feature properties
	 * @returns {string} HTML string
	 */
	generatePopupContent(properties) {
		let html = '<ul>';

		for (const [key, value] of Object.entries(properties)) {
			if (typeof value !== 'object' && key !== 'layer' && key !== 'source') {
				const displayKey = this.alias[key] || key;
				html += `<li><strong>${displayKey}:</strong> ${value}</li>`;
			}
		}

		html += '</ul>';
		return html;
	}

	/**
	 * Replaces the field name alias mapping used for display names.
	 * @param {AliasMapping} newAlias - New alias mapping
	 * @returns {void}
	 */
	updateAlias(newAlias) {
		this.alias = newAlias || {};
	}

	/**
	 * Removes the overlay from the map and clears all DOM references.
	 * @param {OlMap} olMap - OpenLayers map instance
	 * @returns {void}
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
