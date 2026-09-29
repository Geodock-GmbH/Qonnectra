/**
 * Route ids as `page.route.id`, `navigating.to.route.id` and `event.route.id`
 * report them. Predicates on route ids replace pathname sniffing, which
 * breaks whenever the URL shape changes.
 */

/** Route id prefix of every project-scoped page. */
export const PROJECT_ROUTE_PREFIX = '/project/[projectId=integer]';

export const MAP_ROUTE_ID = `${PROJECT_ROUTE_PREFIX}/map`;
export const VALUATION_ROUTE_ID = `${PROJECT_ROUTE_PREFIX}/valuation`;
export const NETWORK_SCHEMA_ROUTE_ID = `${PROJECT_ROUTE_PREFIX}/network-schema`;
export const NETWORK_SCHEMA_CHILD_ROUTE_ID = `${NETWORK_SCHEMA_ROUTE_ID}/node/[nodeId]`;

const NETWORK_SCHEMA_ROUTE_IDS: readonly string[] = [
	NETWORK_SCHEMA_ROUTE_ID,
	NETWORK_SCHEMA_CHILD_ROUTE_ID
];

/**
 * Whether a route id belongs to the network schema, whose server load waits
 * for the schema sync and can take far longer than any other navigation.
 * @param routeId - A `route.id`, or nothing outside a navigation.
 * @returns True for the schema overview and its node detail view.
 */
export function isNetworkSchemaRoute(routeId: string | null | undefined): boolean {
	return routeId != null && NETWORK_SCHEMA_ROUTE_IDS.includes(routeId);
}

/**
 * Whether a route id is the network schema's child view of one node.
 * @param routeId - A `route.id`.
 * @returns True only for the node detail view.
 */
export function isNetworkSchemaChildView(routeId: string | null | undefined): boolean {
	return routeId === NETWORK_SCHEMA_CHILD_ROUTE_ID;
}

/**
 * Whether a route id lies under the project prefix.
 * @param routeId - A `route.id`.
 * @returns True for the project root and every page beneath it.
 */
export function isProjectRoute(routeId: string | null | undefined): boolean {
	return (
		routeId === PROJECT_ROUTE_PREFIX || (routeId?.startsWith(`${PROJECT_ROUTE_PREFIX}/`) ?? false)
	);
}

/**
 * The permission key of a route: its id with the project prefix and every
 * parameter segment stripped (`/valuation`, `/network-schema/node`). The
 * server guard and the navigation both authorise with this key, so they can
 * never disagree.
 * @param routeId - A `route.id`; null when the request matched no route.
 * @returns The key, or null when there is no route to authorise.
 */
export function permissionKeyFor(routeId: string | null | undefined): string | null {
	if (routeId == null) return null;
	const withoutPrefix = isProjectRoute(routeId)
		? routeId.slice(PROJECT_ROUTE_PREFIX.length)
		: routeId;
	const segments = withoutPrefix
		.split('/')
		.filter((segment) => segment !== '' && !segment.startsWith('['));
	return `/${segments.join('/')}`;
}
