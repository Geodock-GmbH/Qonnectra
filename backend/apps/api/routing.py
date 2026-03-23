from collections import OrderedDict
from itertools import product

import networkx as nx
from django.contrib.gis.geos import LineString
from shapely.geometry import shape
from shapely.ops import linemerge
from shapely.wkt import loads as wkt_loads

from .models import Trench


def snap_point(point, tolerance):
    """
    Snaps a point to a grid.

    Points that are within the same grid cell (defined by the tolerance)
    will be snapped to the same coordinate (the bottom-left corner of the cell).

    Args:
        point (tuple): The (x, y) coordinate.
        tolerance (float): The grid cell size for snapping. If 0, no snapping is performed.

    Returns:
        tuple: The snapped (x, y) coordinate.
    """
    if tolerance <= 0:
        return point
    return (
        round(point[0] / tolerance) * tolerance,
        round(point[1] / tolerance) * tolerance,
    )


def find_shortest_path(start_trench_id, end_trench_id, project_id, tolerance=1):
    """Find the shortest path between two trenches using a network graph.

    Build a weighted graph from all :model:`api.Trench` geometries in the
    given project, then compute the shortest path between the specified
    start and end trenches.

    Args:
        start_trench_id (str): The id_trench of the starting trench (e.g., 'TR-ABC123X').
        end_trench_id (str): The id_trench of the ending trench (e.g., 'TR-ABC123X').
        project_id (int): Primary key of the :model:`api.Projects` to scope the search.
        tolerance (int): Grid cell size for snapping endpoints. If 0, no snapping
            is performed. Defaults to 1.

    Returns:
        dict: On success, contains 'start_trench_id', 'end_trench_id',
            'path_length', 'traversed_trench_ids', 'traversed_trench_uuids',
            and 'path_geometry_wkt'. On failure, contains a single 'error' key.
    """

    trenches = Trench.objects.filter(project=project_id).only(
        "uuid", "id_trench", "geom", "length"
    )
    if not trenches.exists():
        return {"error": "No trenches found in the database."}

    trench_data = {t.id_trench: t for t in trenches}

    G = nx.Graph()
    for id_trench, trench in trench_data.items():
        geom = trench.geom
        if geom is None or not isinstance(geom, LineString) or geom.empty:
            continue

        start_point = geom.coords[0]
        end_point = geom.coords[-1]
        start_node = snap_point(start_point, tolerance)
        end_node = snap_point(end_point, tolerance)

        if start_node == end_node:
            continue

        G.add_edge(
            start_node,
            end_node,
            id_trench=id_trench,
            weight=float(trench.length),
        )

    try:
        start_trench = trench_data[start_trench_id]
        end_trench = trench_data[end_trench_id]
    except KeyError as e:
        return {"error": f"Trench with id {e.args[0]} not found."}

    start_geom = start_trench.geom
    start_nodes = [
        snap_point(start_geom.coords[0], tolerance),
        snap_point(start_geom.coords[-1], tolerance),
    ]

    end_geom = end_trench.geom
    end_nodes = [
        snap_point(end_geom.coords[0], tolerance),
        snap_point(end_geom.coords[-1], tolerance),
    ]

    shortest_path_nodes = None
    min_path_length = float("inf")

    for start_node, end_node in product(start_nodes, end_nodes):
        if start_node not in G or end_node not in G:
            continue
        try:
            path_length, path_nodes = nx.single_source_dijkstra(
                G, source=start_node, target=end_node, weight="weight"
            )
            if path_length < min_path_length:
                min_path_length = path_length
                shortest_path_nodes = path_nodes
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue

    if shortest_path_nodes is None:
        return {
            "error": f"No path found between trench {start_trench_id} and {end_trench_id}."
        }

    path_segment_ids = []
    for i in range(len(shortest_path_nodes) - 1):
        u, v = shortest_path_nodes[i], shortest_path_nodes[i + 1]
        edge_data = G.get_edge_data(u, v)
        path_segment_ids.append(edge_data["id_trench"])

    final_path_ids = list(
        OrderedDict.fromkeys([start_trench_id] + path_segment_ids + [end_trench_id])
    )

    final_path_uuids = [str(trench_data[tid].uuid) for tid in final_path_ids]

    path_geometries_geos = [trench_data[tid].geom for tid in final_path_ids]
    # Convert GEOS → Shapely for linemerge (GEOS LineStrings lack merge support)
    path_geometries_shapely = [wkt_loads(geom.wkt) for geom in path_geometries_geos]
    merged_line = linemerge(path_geometries_shapely)

    return {
        "start_trench_id": start_trench_id,
        "end_trench_id": end_trench_id,
        "path_length": merged_line.length
        if hasattr(merged_line, "length")
        else min_path_length,
        "traversed_trench_ids": final_path_ids,
        "traversed_trench_uuids": final_path_uuids,
        "path_geometry_wkt": merged_line.wkt,
    }


def find_path_through_trenches(trenches, start_point, end_point, tolerance=1, connection_tolerance=5):
    """Find the shortest path through a set of trenches between two points.

    Build a vertex-level graph from trench geometries where every vertex is a
    node and consecutive vertices along a trench are connected by edges.
    Then connect nearby trench endpoints to segments of other trenches by
    projecting endpoints onto nearby segments (handles T-junctions where
    a spur trench ends near but not exactly on the main trench, possibly
    at a mid-segment point with no existing vertex).

    Args:
        trenches (list[dict]): Trench dicts with 'id' (UUID str) and 'geometry'
            (GeoJSON dict). Typically from ``_get_cable_infrastructure``.
        start_point (tuple): The (x, y) coordinate of the start node.
        end_point (tuple): The (x, y) coordinate of the end node.
        tolerance (float): Grid cell size for snapping vertices. Defaults to 1.
        connection_tolerance (float): Maximum distance (meters) to connect a
            trench endpoint to a nearby segment on another trench. Defaults to 5.

    Returns:
        tuple: ``(path_trench_ids, trench_path_coords)`` where
            *path_trench_ids* is an ordered list of trench UUIDs and
            *trench_path_coords* maps each trench UUID to the graph nodes
            traversed on it (for geometry trimming).  Returns ``(None, None)``
            if no path could be found.
    """
    if not trenches or not start_point or not end_point:
        return None, None

    # Parse geometries and collect per-trench coordinate lists
    trench_coords = {}
    for trench in trenches:
        geom_json = trench.get("geometry")
        if not geom_json:
            continue
        try:
            geom = shape(geom_json)
        except Exception:
            continue
        if geom.is_empty or geom.geom_type != "LineString":
            continue
        coords = list(geom.coords)
        if len(coords) < 2:
            continue
        trench_coords[trench["id"]] = [(c[0], c[1]) for c in coords]

    if not trench_coords:
        return None, None

    G = nx.Graph()

    # Step 1: Add edges along each trench (consecutive vertices)
    for trench_id, coords in trench_coords.items():
        for i in range(len(coords) - 1):
            node_a = snap_point(coords[i], tolerance)
            node_b = snap_point(coords[i + 1], tolerance)
            if node_a == node_b:
                continue
            dx = coords[i + 1][0] - coords[i][0]
            dy = coords[i + 1][1] - coords[i][1]
            seg_length = (dx * dx + dy * dy) ** 0.5
            G.add_edge(node_a, node_b, trench_id=trench_id, weight=seg_length)

    if G.number_of_edges() == 0:
        return None

    # Step 2: Connect nearby trench endpoints to segments of other trenches.
    ct_sq = connection_tolerance * connection_tolerance

    for tid_a, coords_a in trench_coords.items():
        endpoints = [coords_a[0], coords_a[-1]]
        for ep in endpoints:
            snapped_ep = snap_point(ep, tolerance)
            if G.degree(snapped_ep) > 1 if snapped_ep in G else False:
                continue

            best_dist_sq = ct_sq
            best_proj = None
            best_seg_a = None
            best_seg_b = None
            best_tid = None

            for tid_b, coords_b in trench_coords.items():
                if tid_b == tid_a:
                    continue
                for i in range(len(coords_b) - 1):
                    proj, dsq = _project_point_onto_segment(
                        ep, coords_b[i], coords_b[i + 1]
                    )
                    if dsq < best_dist_sq:
                        best_dist_sq = dsq
                        best_proj = proj
                        best_seg_a = snap_point(coords_b[i], tolerance)
                        best_seg_b = snap_point(coords_b[i + 1], tolerance)
                        best_tid = tid_b

            if best_proj is not None:
                snapped_proj = snap_point(best_proj, tolerance)

                # Determine the node to split at: if the projection snaps
                # to the same point as the endpoint, the endpoint lies
                # directly on the other trench's segment — split at it.
                split_node = snapped_proj if snapped_proj != snapped_ep else snapped_ep

                # Insert split_node into the segment (split it)
                if split_node != best_seg_a and split_node != best_seg_b:
                    if G.has_edge(best_seg_a, best_seg_b):
                        old_data = G.get_edge_data(best_seg_a, best_seg_b)
                        G.remove_edge(best_seg_a, best_seg_b)
                        d1 = _point_dist(best_seg_a, split_node)
                        d2 = _point_dist(split_node, best_seg_b)
                        G.add_edge(
                            best_seg_a, split_node,
                            trench_id=old_data["trench_id"], weight=d1,
                        )
                        G.add_edge(
                            split_node, best_seg_b,
                            trench_id=old_data["trench_id"], weight=d2,
                        )

                # Add bridging edge if the projection is a different node
                if snapped_proj != snapped_ep:
                    bridge_dist = best_dist_sq ** 0.5
                    G.add_edge(
                        snapped_ep, snapped_proj,
                        trench_id=tid_a, weight=bridge_dist,
                    )

    # Step 3: Find source and target in the graph
    snapped_start = snap_point(start_point, tolerance)
    snapped_end = snap_point(end_point, tolerance)

    def nearest_graph_node(point):
        if point in G:
            return point
        max_dist_sq = connection_tolerance * connection_tolerance
        min_dist = float("inf")
        closest = None
        for node in G.nodes:
            dist = (node[0] - point[0]) ** 2 + (node[1] - point[1]) ** 2
            if dist < min_dist:
                min_dist = dist
                closest = node
        if min_dist > max_dist_sq:
            return None
        return closest

    source = nearest_graph_node(snapped_start)
    target = nearest_graph_node(snapped_end)

    if source is None or target is None or source == target:
        return None, None

    try:
        path_nodes = nx.shortest_path(
            G, source=source, target=target, weight="weight"
        )
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None, None

    # Collect unique trench IDs in traversal order, and the path
    # coordinates that fall on each trench (for geometry trimming).
    path_trench_ids = []
    trench_path_coords = {}
    seen = set()
    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i + 1]
        edge_data = G.get_edge_data(u, v)
        tid = edge_data["trench_id"]
        if tid not in seen:
            path_trench_ids.append(tid)
            trench_path_coords[tid] = [u]
            seen.add(tid)
        trench_path_coords[tid].append(v)

    return path_trench_ids, trench_path_coords


def _project_point_onto_segment(point, seg_a, seg_b):
    """Project a point onto a line segment, returning the closest point and squared distance.

    Args:
        point: (x, y) tuple
        seg_a: (x, y) tuple - segment start
        seg_b: (x, y) tuple - segment end

    Returns:
        tuple: ((proj_x, proj_y), squared_distance)
    """
    dx = seg_b[0] - seg_a[0]
    dy = seg_b[1] - seg_a[1]
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        d = (point[0] - seg_a[0]) ** 2 + (point[1] - seg_a[1]) ** 2
        return seg_a, d

    t = ((point[0] - seg_a[0]) * dx + (point[1] - seg_a[1]) * dy) / len_sq
    t = max(0.0, min(1.0, t))

    proj_x = seg_a[0] + t * dx
    proj_y = seg_a[1] + t * dy
    dsq = (point[0] - proj_x) ** 2 + (point[1] - proj_y) ** 2
    return (proj_x, proj_y), dsq


def _point_dist(a, b):
    """Euclidean distance between two (x, y) tuples."""
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
