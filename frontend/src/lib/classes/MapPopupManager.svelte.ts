import type Feature from 'ol/Feature.js';
import type OlMap from 'ol/Map.js';
import type RenderFeature from 'ol/render/Feature.js';
import Overlay from 'ol/Overlay.js';

type AliasMapping = Record<string, string>;

type FeatureProperties = Record<string, unknown>;

/**
 * Manages popup overlays on the map
 * Handles creation, positioning, content generation, and lifecycle
 */
export class MapPopupManager {
	overlay: Overlay | null = $state(null);
	popupContainer: HTMLElement | null = $state(null);
	contentElement: HTMLElement | null = $state(null);
	closerElement: HTMLElement | null = $state(null);
	alias: AliasMapping = $state({});

	constructor(alias: AliasMapping = {}) {
		this.alias = alias;
	}

	/**
	 * Initializes the popup overlay by locating DOM elements and attaching to the map.
	 * @param olMap - OpenLayers map instance
	 * @returns True if initialization succeeded
	 */
	initialize(olMap: OlMap): boolean {
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
	 * @param coordinate - Map coordinates [x, y]
	 * @param feature - OpenLayers feature
	 */
	show(coordinate: number[], feature: Feature | RenderFeature): void {
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
	 */
	hide(): void {
		if (this.overlay) {
			this.overlay.setPosition(undefined);
		}
		if (this.closerElement) {
			this.closerElement.blur();
		}
	}

	/**
	 * Generates an HTML list of feature properties, skipping geometry and metadata fields.
	 * @param properties - Feature properties
	 * @returns HTML string
	 */
	generatePopupContent(properties: FeatureProperties): string {
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
	 * @param newAlias - New alias mapping
	 */
	updateAlias(newAlias: AliasMapping): void {
		this.alias = newAlias || {};
	}

	/**
	 * Removes the overlay from the map and clears all DOM references.
	 * @param olMap - OpenLayers map instance
	 */
	cleanup(olMap: OlMap): void {
		if (olMap && this.overlay) {
			olMap.removeOverlay(this.overlay);
		}
		this.overlay = null;
		this.popupContainer = null;
		this.contentElement = null;
		this.closerElement = null;
	}
}
