from collections import OrderedDict
from itertools import product

import networkx as nx
from django.contrib.gis.geos import LineString
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
            path_nodes = nx.shortest_path(
                G, source=start_node, target=end_node, weight="weight"
            )
            path_length = nx.shortest_path_length(
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

    final_path_uuids = [str(trench_data[id].uuid) for id in final_path_ids]

    path_geometries_geos = [trench_data[id].geom for id in final_path_ids]
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
