import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';

let registeredSrid: number | null = null;

/**
 * Registers the storage SRID projection with proj4 and OpenLayers.
 * Safe to call multiple times -- only registers once per SRID.
 */
export function registerStorageProjection(srid: number, proj4Def: string): void {
	if (registeredSrid === srid) return;
	proj4.defs(`EPSG:${srid}`, proj4Def);
	register(proj4);
	registeredSrid = srid;
}

/**
 * Returns the EPSG projection string for the storage SRID.
 */
export function storageProjection(srid: number): string {
	return `EPSG:${srid}`;
}
