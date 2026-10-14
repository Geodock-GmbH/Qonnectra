"""Checks how a run discovers its projects, samples and WMS layers."""

import pytest

from qonnectra_loadtest.config import RunOptions
from qonnectra_loadtest.fixtures import FixtureError, discover, select_projects
from tests.fakes import FakeHttp

OPTIONS = RunOptions(app_url="https://app", api_url="https://api/api/v1/", tiles_url="")


def api(
    projects_selection: str = "all", wms: bool = True
) -> tuple[RunOptions, FakeHttp]:
    """Return options and a fake API with one real and one seeded project."""
    options = RunOptions(
        app_url="https://app",
        api_url="https://api/api/v1/",
        tiles_url="",
        projects=projects_selection,
        wms=wms,
    )
    http = FakeHttp(
        {
            "projects/?active=1&page_size=100": {
                "results": [
                    {"id": 1, "project": "Kassel"},
                    {"id": 7, "project": "loadtest-01"},
                    {"id": 9, "project": "Empty"},
                ]
            },
            "layer-extent/?layer=trench&project=1": {"extent": [0, 0, 10, 10]},
            "layer-extent/?layer=trench&project=7": {"extent": [5, 5, 15, 15]},
            "layer-extent/?layer=trench&project=9": {"extent": None},
            "trench/?project=1&page_size=100": {
                "type": "FeatureCollection",
                "features": [
                    {"id": "t1", "properties": {"id_trench": "A1"}},
                    {"properties": {"uuid": "t2"}},
                ],
            },
            "node/?project=1&page_size=100": {"results": [{"uuid": "n1"}]},
            "address/?project=1&page_size=100": [],
            "cable/?project=1&page_size=100": {"results": []},
            "wms-sources/?project=1": [
                {
                    "id": 3,
                    "is_active": True,
                    "layers": [
                        {
                            "name": "Flurstücke",
                            "is_enabled": True,
                            "min_zoom": 12,
                            "max_zoom": None,
                        },
                        {"name": "off", "is_enabled": False},
                    ],
                },
                {
                    "id": 4,
                    "is_active": False,
                    "layers": [{"name": "x", "is_enabled": True}],
                },
            ],
            "attributes_conduit_type/": [{"id": 11}],
            "flags/": {"results": [{"id": 2}]},
        }
    )
    return options, http


def test_discovers_projects_samples_and_wms_layers():
    """Verify extents, feature samples, enabled layers and lookups are collected."""
    options, http = api()

    fixture = discover(options, "token", http=http)

    kassel, seeded = fixture.projects
    assert (kassel.id, kassel.extent, kassel.seeded) == (1, (0, 0, 10, 10), False)
    assert kassel.features["trench"] == ["t1", "t2"]
    assert kassel.trench_ids == ["A1"]
    assert kassel.features["node"] == ["n1"]
    assert [
        (layer.source, layer.name, layer.min_zoom) for layer in kassel.wms_layers
    ] == [("3", "Flurstücke", 12)]
    assert seeded.seeded
    assert (fixture.conduit_type_id, fixture.flag_id) == (11, 2)
    assert all(call[2]["Authorization"] == "Bearer token" for call in http.calls)


def test_projects_without_trenches_are_skipped():
    """Verify a project without a trench extent is not used."""
    options, http = api()

    assert [p.id for p in discover(options, "t", http=http).projects] == [1, 7]


def test_wms_off_skips_the_wms_lookup():
    """Verify WMS sources are not even requested when WMS is off."""
    options, http = api(wms=False)

    discover(options, "t", http=http)

    assert not any("wms-sources" in url for _, url, _ in http.calls)


def test_no_matching_project_is_an_error():
    """Verify an empty selection stops the run with a clear message."""
    options, http = api("42")

    with pytest.raises(FixtureError, match="42"):
        discover(options, "t", http=http)


def test_project_selection():
    """Verify all, loadtest and id lists."""
    rows = [{"id": 1, "project": "a"}, {"id": 2, "project": "loadtest-01"}]

    assert select_projects(rows, "all") == rows
    assert select_projects(rows, "loadtest") == [rows[1]]
    assert select_projects(rows, "1, x") == [rows[0]]
