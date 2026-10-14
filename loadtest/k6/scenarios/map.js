/**
 * Map persona: opens a project's map, then pans and zooms around the area
 * with pauses and now and then clicks a feature to read its drawer tabs.
 * One iteration is one map session of 10–30 gestures.
 */
import { api, batch, page, remote } from '../lib/client.js';
import { config } from '../lib/config.js';
import { between, chance, pick, think, weighted } from '../lib/random.js';
import { fitZoom, step, tileBbox, TileCache, tilesForView } from '../lib/tiles.js';

const VECTOR_LAYERS = ['trench', 'address', 'node', 'area'];

/** Tiles each source keeps, roughly OpenLayers' cache for a large viewport. */
const CACHE_TILES = 256;

/** WMS tokens live 5 minutes; the app's heartbeat renews them every 3. */
const WMS_TOKEN_TTL_MS = 170_000;

/** @type {{ token: string, fetchedAt: number } | null} */
let wmsToken = null;

/**
 * Returns a fresh WMS access token, fetching one when the cached one is old.
 * @returns {string}
 */
function currentWmsToken() {
	if (!wmsToken || Date.now() - wmsToken.fetchedAt > WMS_TOKEN_TTL_MS) {
		const response = api('wms-sources/access_token/', 'wms:access_token', { text: true });
		let token = '';
		try {
			token = JSON.parse(String(response.body)).token ?? '';
		} catch {
			token = '';
		}
		wmsToken = { token, fetchedAt: Date.now() };
	}
	return wmsToken.token;
}

/**
 * Requests every tile of the view that the per-layer caches do not hold yet.
 * @param {import('../lib/fixtures.js').ProjectFixture} project
 * @param {import('../lib/tiles.js').View} view
 * @param {Record<string, TileCache>} caches
 */
function loadView(project, view, caches) {
	const tiles = tilesForView(view);
	/** @type {{ url: string, name: string, tags?: Record<string, string> }[]} */
	const requests = [];

	for (const layer of VECTOR_LAYERS) {
		for (const tile of caches[layer].missing(tiles)) {
			const bust = config.cache === 'bypass' ? `&_lt=${Math.random().toString(36).slice(2)}` : '';
			const url = `${config.apiUrl}ol_${layer}_tiles/${tile.z}/${tile.x}/${tile.y}.mvt?project=${project.id}${bust}`;
			for (let copy = 0; copy < config.tileFactor; copy++) {
				requests.push({ url, name: `tile:${layer}`, tags: { z: String(tile.z) } });
			}
		}
	}

	const visibleWms = project.wmsLayers.filter(
		(layer) => view.zoom > layer.minZoom && (layer.maxZoom === null || view.zoom <= layer.maxZoom)
	);
	if (visibleWms.length) {
		const token = encodeURIComponent(currentWmsToken());
		for (const layer of visibleWms) {
			const key = `wms:${layer.source}:${layer.name}`;
			caches[key] ??= new TileCache(CACHE_TILES);
			for (const tile of caches[key].missing(tiles)) {
				requests.push({
					url:
						`${config.apiUrl}wms-proxy/${layer.source}/?token=${token}&SERVICE=WMS&VERSION=1.3.0` +
						`&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true&LAYERS=${encodeURIComponent(layer.name)}` +
						`&CRS=EPSG%3A3857&STYLES=&WIDTH=512&HEIGHT=512&BBOX=${tileBbox(tile)}`,
					name: 'tile:wms',
					tags: { z: String(tile.z) }
				});
			}
		}
	}

	batch(requests);
}

/**
 * Clicks a known feature and opens some of its drawer tabs.
 * @param {import('../lib/fixtures.js').ProjectFixture} project
 * @param {string} pagePath
 */
function clickFeature(project, pagePath) {
	const kind = weighted({ trench: 6, node: 2.5, address: 1.5 });
	const uuid = pick(project.features[kind]);
	if (!uuid) return;
	const search = `?feature=${kind}:${uuid}`;
	const projectId = String(project.id);

	remote(
		'getFeatureDetails',
		{ featureType: kind, featureUuid: uuid, projectId },
		pagePath,
		search
	);
	if (kind !== 'trench') return;

	remote('getConduitsInTrench', uuid, pagePath, search);
	think(1, 3);
	if (chance(0.3)) remote('getCablesInTrench', uuid, pagePath, search);
	if (chance(0.2)) remote('getTrenchProfile', uuid, pagePath, search);
}

/**
 * Runs one map session.
 * @param {{ projects: import('../lib/fixtures.js').ProjectFixture[] }} data - setup() fixture.
 */
export function mapSession(data) {
	const project = /** @type {import('../lib/fixtures.js').ProjectFixture} */ (pick(data.projects));
	const pagePath = `/project/${project.id}/map`;

	page(pagePath, 'page:map');
	remote('getLayerStyleAttributes', undefined, pagePath);
	if (config.wms) {
		currentWmsToken();
		api(`wms-sources/?project=${project.id}`, 'wms:sources');
	}

	/** @type {Record<string, TileCache>} */
	const caches = Object.fromEntries(
		VECTOR_LAYERS.map((layer) => [layer, new TileCache(CACHE_TILES)])
	);
	const { width, height } = config.viewport;
	const extent = project.extent;
	const minZoom = fitZoom(extent, width, height);
	/** @type {import('../lib/tiles.js').View} */
	let view = {
		x: (extent[0] + extent[2]) / 2,
		y: (extent[1] + extent[3]) / 2,
		zoom: minZoom,
		width,
		height
	};
	loadView(project, view, caches);

	const gestures = between(10, 30);
	for (let i = 0; i < gestures; i++) {
		think(1, 4);
		const gesture = weighted({ pan: 5, zoomIn: 2.5, zoomOut: 1.5, click: 1 });
		if (gesture === 'click') {
			clickFeature(project, pagePath);
			continue;
		}
		view = step(view, gesture, extent, Math.random, minZoom - 1);
		loadView(project, view, caches);
	}
}
