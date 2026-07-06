import { setContext } from 'svelte';

const INQUIRY_CONTEXT_KEY = Symbol('inquiryContext');

/**
 * @typedef {Object} InquiryPolygon
 * @property {string} uuid
 * @property {string|null} name
 * @property {any} geom
 * @property {string} created_at
 */

/**
 * @typedef {Object} InquiryContext
 * @property {InquiryPolygon[]} polygons
 * @property {boolean} isDrawing
 * @property {boolean} isEditing
 * @property {boolean} isSaving
 * @property {(polygon: InquiryPolygon) => void} addPolygon
 * @property {(uuid: string) => void} removePolygon
 * @property {(uuid: string, geom: any) => void} updatePolygonGeom
 * @property {(uuid: string, name: string) => void} updatePolygonName
 * @property {(polygons: InquiryPolygon[]) => void} setPolygons
 * @property {(value: boolean) => void} setDrawing
 * @property {(value: boolean) => void} setEditing
 * @property {(value: boolean) => void} setSaving
 * @property {() => void} reset
 */

/**
 * Create and set the inquiry context for polygon drawing state.
 * @returns {InquiryContext}
 */
export function createInquiryContext() {
	/** @type {InquiryPolygon[]} */
	let polygons = $state([]);
	let isDrawing = $state(false);
	let isEditing = $state(false);
	let isSaving = $state(false);

	const context = {
		get polygons() {
			return polygons;
		},
		get isDrawing() {
			return isDrawing;
		},
		get isEditing() {
			return isEditing;
		},
		get isSaving() {
			return isSaving;
		},
		/**
		 * @param {InquiryPolygon} polygon
		 */
		addPolygon(polygon) {
			polygons = [...polygons, polygon];
		},
		/**
		 * @param {string} uuid
		 */
		removePolygon(uuid) {
			polygons = polygons.filter((p) => p.uuid !== uuid);
		},
		/**
		 * @param {string} uuid
		 * @param {any} geom
		 */
		updatePolygonGeom(uuid, geom) {
			polygons = polygons.map((p) => (p.uuid === uuid ? { ...p, geom } : p));
		},
		/**
		 * @param {string} uuid
		 * @param {string} name
		 */
		updatePolygonName(uuid, name) {
			polygons = polygons.map((p) => (p.uuid === uuid ? { ...p, name } : p));
		},
		/**
		 * @param {InquiryPolygon[]} newPolygons
		 */
		setPolygons(newPolygons) {
			polygons = newPolygons;
		},
		/**
		 * @param {boolean} value
		 */
		setDrawing(value) {
			isDrawing = value;
		},
		/**
		 * @param {boolean} value
		 */
		setEditing(value) {
			isEditing = value;
		},
		/**
		 * @param {boolean} value
		 */
		setSaving(value) {
			isSaving = value;
		},
		reset() {
			polygons = [];
			isDrawing = false;
			isEditing = false;
			isSaving = false;
		}
	};

	setContext(INQUIRY_CONTEXT_KEY, context);
	return context;
}
