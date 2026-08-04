import { getContext, setContext } from 'svelte';

const INQUIRY_CONTEXT_KEY = Symbol('inquiryContext');

/** Raw GeoJSON geometry object from the API. */
export interface GeoJSONGeometry {
	type: string;
	coordinates: unknown;
}

export interface InquiryPolygon {
	uuid: string;
	name: string | null;
	geom: GeoJSONGeometry | null;
	created_at: string;
}

export interface InquiryContext {
	readonly polygons: InquiryPolygon[];
	readonly isDrawing: boolean;
	readonly isEditing: boolean;
	readonly isSaving: boolean;
	addPolygon(polygon: InquiryPolygon): void;
	removePolygon(uuid: string): void;
	updatePolygonGeom(uuid: string, geom: GeoJSONGeometry | null): void;
	updatePolygonName(uuid: string, name: string): void;
	setPolygons(polygons: InquiryPolygon[]): void;
	setDrawing(value: boolean): void;
	setEditing(value: boolean): void;
	setSaving(value: boolean): void;
	reset(): void;
}

/**
 * Create and set the inquiry context for polygon drawing state.
 */
export function createInquiryContext(): InquiryContext {
	let polygons: InquiryPolygon[] = $state([]);
	let isDrawing: boolean = $state(false);
	let isEditing: boolean = $state(false);
	let isSaving: boolean = $state(false);

	const context: InquiryContext = {
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
		addPolygon(polygon: InquiryPolygon) {
			polygons = [...polygons, polygon];
		},
		removePolygon(uuid: string) {
			polygons = polygons.filter((p) => p.uuid !== uuid);
		},
		updatePolygonGeom(uuid: string, geom: GeoJSONGeometry | null) {
			polygons = polygons.map((p) => (p.uuid === uuid ? { ...p, geom } : p));
		},
		updatePolygonName(uuid: string, name: string) {
			polygons = polygons.map((p) => (p.uuid === uuid ? { ...p, name } : p));
		},
		setPolygons(newPolygons: InquiryPolygon[]) {
			polygons = newPolygons;
		},
		setDrawing(value: boolean) {
			isDrawing = value;
		},
		setEditing(value: boolean) {
			isEditing = value;
		},
		setSaving(value: boolean) {
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

/**
 * Retrieve the inquiry context from a parent component.
 */
export function getInquiryContext(): InquiryContext {
	return getContext<InquiryContext>(INQUIRY_CONTEXT_KEY);
}
