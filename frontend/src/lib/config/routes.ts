/**
 * Route ids of the network schema pages, as `page.route.id` and
 * `navigating.to.route.id` report them. Predicates on route ids replace
 * pathname sniffing, which breaks whenever the URL shape changes.
 */
const NETWORK_SCHEMA_ROUTE_IDS: readonly string[] = [
	'/network-schema/[[projectId]]',
	'/network-schema/[[projectId]]/node/[nodeId]'
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
