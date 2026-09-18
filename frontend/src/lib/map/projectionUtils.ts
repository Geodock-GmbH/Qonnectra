import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';

let registeredSrid: number | null = null;

/**
 * Registers the storage SRID projection with proj4 and OpenLayers.
 * Safe to call multiple times -- only registers once per SRID.
 * @param srid - The storage SRID to register.
 * @param proj4Def - The proj4 definition of that SRID.
 */
export function registerStorageProjection(srid: number, proj4Def: string): void {
	if (registeredSrid === srid) return;
	proj4.defs(`EPSG:${srid}`, proj4Def);
	register(proj4);
	registeredSrid = srid;
}

/**
 * Returns the EPSG projection string for the storage SRID.
 * @param srid - The storage SRID.
 * @returns The `EPSG:<srid>` projection code.
 */
export function storageProjection(srid: number): string {
	return `EPSG:${srid}`;
}

/**
 * Formats an EPSG:3857 point as a `lat, lon` string in EPSG:4326.
 * @param coordinates - The point in EPSG:3857.
 * @returns The `lat, lon` string, each to six decimals.
 */
export function formatLatLon(coordinates: number[]): string {
	const [lon, lat] = proj4('EPSG:3857', 'EPSG:4326', coordinates);
	return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/**
 * Formats an EPSG:3857 point as an `x, y` string in the storage SRID.
 * @param coordinates - The point in EPSG:3857.
 * @param srid - The storage SRID.
 * @param proj4Def - The proj4 definition of the storage SRID.
 * @returns The `x, y` string in the storage SRID, each to six decimals.
 */
export function formatStorageCoordinates(
	coordinates: number[],
	srid: number,
	proj4Def: string
): string {
	registerStorageProjection(srid, proj4Def);
	const [x, y] = proj4('EPSG:3857', storageProjection(srid), coordinates);
	return `${x.toFixed(6)}, ${y.toFixed(6)}`;
}
