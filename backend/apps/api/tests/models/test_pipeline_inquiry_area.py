"""Tests for PipelineInquiryArea model."""

import pytest
from django.contrib.gis.geos import Polygon

from apps.api.models import PipelineInquiryArea

from ..factories import PipelineInquiryAreaFactory, PipelineRecordFactory, ProjectFactory


@pytest.mark.django_db
class TestPipelineInquiryAreaModel:
    """Tests for the PipelineInquiryArea model."""

    def test_creation_with_all_fields(self):
        record = PipelineRecordFactory()
        polygon = Polygon(
            ((0, 0), (100, 0), (100, 100), (0, 100), (0, 0)), srid=25832
        )
        area = PipelineInquiryArea.objects.create(
            pipeline_record=record,
            name="Test Inquiry Area",
            geom=polygon,
        )
        assert area.uuid is not None
        assert area.pipeline_record == record
        assert area.name == "Test Inquiry Area"
        assert area.created_at is not None
        assert area.modified_at is not None

    def test_creation_without_optional_name(self):
        record = PipelineRecordFactory()
        polygon = Polygon(
            ((0, 0), (100, 0), (100, 100), (0, 100), (0, 0)), srid=25832
        )
        area = PipelineInquiryArea.objects.create(
            pipeline_record=record,
            geom=polygon,
        )
        assert area.uuid is not None
        assert area.name is None

    def test_str_returns_name_or_uuid(self):
        area_with_name = PipelineInquiryAreaFactory(name="Named Area")
        assert str(area_with_name) == "Named Area"

        area_without_name = PipelineInquiryAreaFactory(name=None)
        assert str(area_without_name) == str(area_without_name.uuid)

    def test_cascade_delete_with_pipeline_record(self):
        record = PipelineRecordFactory()
        PipelineInquiryAreaFactory(pipeline_record=record)
        assert PipelineInquiryArea.objects.count() == 1
        record.delete()
        assert PipelineInquiryArea.objects.count() == 0

    def test_cascade_delete_with_project(self):
        project = ProjectFactory()
        record = PipelineRecordFactory(project=project)
        PipelineInquiryAreaFactory(pipeline_record=record)
        assert PipelineInquiryArea.objects.count() == 1
        project.delete()
        assert PipelineInquiryArea.objects.count() == 0

    def test_has_history(self):
        area = PipelineInquiryAreaFactory()
        assert area.history.count() == 1

    def test_geom_3857_generated(self):
        area = PipelineInquiryAreaFactory()
        area.refresh_from_db()
        assert area.geom_3857 is not None
        assert area.geom_3857.srid == 3857

    def test_multiple_areas_per_record(self):
        record = PipelineRecordFactory()
        PipelineInquiryAreaFactory.create_batch(3, pipeline_record=record)
        assert record.inquiry_areas.count() == 3
