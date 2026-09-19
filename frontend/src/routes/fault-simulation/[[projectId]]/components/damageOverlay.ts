import type { StorageProjection } from '$lib/map/projectionUtils.js';
import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import type { Coordinate } from 'ol/coordinate.js';
import type { FeatureLike } from 'ol/Feature.js';
import type OlMap from 'ol/Map.js';
import type Style from 'ol/style/Style.js';
import Feature from 'ol/Feature.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';

import { storageReadOptions } from '$lib/map/projectionUtils.js';
import {
	createAffectedAddressStyle,
	createAffectedNodeStyle,
	createAffectedTrenchStyle,
	createDamagePointStyle
} from '$lib/map/styles';

/**
 * Map layers that visualise a fault simulation: the damage point and the
 * trenches, nodes and addresses the simulated damage takes down.
 */
export class DamageOverlay {
	private map: OlMap | null = null;
	private storage: StorageProjection | null = null;
	private result: FaultSimulationResult | null = null;

	readonly damagePointSource = new VectorSource();
	readonly affectedTrenchSource = new VectorSource();
	readonly affectedNodeSource = new VectorSource();
	readonly affectedAddressSource = new VectorSource();

	private readonly layers: VectorLayer[];

	constructor() {
		const nodeDefaultStyle = createAffectedNodeStyle('default');
		const nodeAddressStyle = createAffectedNodeStyle('address');
		const nodeStyle = (feature: FeatureLike): Style =>
			feature.get('has_address') ? nodeAddressStyle : nodeDefaultStyle;

		this.layers = [
			new VectorLayer({
				source: this.affectedTrenchSource,
				style: createAffectedTrenchStyle(),
				zIndex: 50
			}),
			new VectorLayer({
				source: this.affectedAddressSource,
				style: createAffectedAddressStyle(),
				zIndex: 55
			}),
			new VectorLayer({ source: this.affectedNodeSource, style: nodeStyle, zIndex: 60 }),
			new VectorLayer({
				source: this.damagePointSource,
				style: createDamagePointStyle(),
				zIndex: 100
			})
		];
	}

	/**
	 * Adds the overlay layers to a map and draws a result that arrived before the map did.
	 * @param map - The map to draw on.
	 * @param storage - Projection the simulation geometries arrive in.
	 */
	attach(map: OlMap, storage: StorageProjection | null): void {
		this.map = map;
		this.storage = storage;
		for (const layer of this.layers) map.addLayer(layer);
		if (this.result) this.showResult(this.result);
	}

	/** Removes the overlay layers from the map they were attached to. */
	detach(): void {
		if (!this.map) return;
		for (const layer of this.layers) this.map.removeLayer(layer);
		this.map = null;
	}

	/**
	 * Marks the damage location and drops any previously drawn result.
	 * @param coordinate - Damage location in the map's view projection.
	 */
	showDamagePoint(coordinate: Coordinate): void {
		this.damagePointSource.clear();
		this.damagePointSource.addFeature(new Feature({ geometry: new Point(coordinate) }));
		this.clearResult();
	}

	/**
	 * Draws the affected trenches, nodes and addresses of a simulation result.
	 * @param result - The simulation result carrying the affected geometries.
	 */
	showResult(result: FaultSimulationResult): void {
		this.clearResult();
		this.result = result;
		if (!this.map || !result.geometry) return;

		const readOptions = storageReadOptions(this.storage, this.map.getView().getProjection());
		const format = new GeoJSON();
		const { affected_trenches, affected_nodes, affected_addresses } = result.geometry;

		if (affected_trenches) {
			this.affectedTrenchSource.addFeatures(format.readFeatures(affected_trenches, readOptions));
		}
		if (affected_nodes) {
			this.affectedNodeSource.addFeatures(format.readFeatures(affected_nodes, readOptions));
		}
		if (affected_addresses) {
			this.affectedAddressSource.addFeatures(format.readFeatures(affected_addresses, readOptions));
		}
	}

	/** Removes the drawn simulation result, keeping the damage point. */
	clearResult(): void {
		this.result = null;
		this.affectedTrenchSource.clear();
		this.affectedNodeSource.clear();
		this.affectedAddressSource.clear();
	}

	/** Removes the damage point and the drawn simulation result. */
	clear(): void {
		this.damagePointSource.clear();
		this.clearResult();
	}
}
