import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';

/** @type {number | null} */
let registeredSrid = null;

/**
 * Registers the storage SRID projection with proj4 and OpenLayers.
 * Safe to call multiple times — only registers once per SRID.
 * @param {number} srid - The EPSG code (e.g. 25832).
 * @param {string} proj4Def - The proj4 definition string.
 */
export function registerStorageProjection(srid, proj4Def) {
	if (registeredSrid === srid) return;
	proj4.defs(`EPSG:${srid}`, proj4Def);
	register(proj4);
	registeredSrid = srid;
}

/**
 * Returns the EPSG projection string for the storage SRID.
 * @param {number} srid - The EPSG code.
 * @returns {string} e.g. 'EPSG:25832'
 */
export function storageProjection(srid) {
	return `EPSG:${srid}`;
}
