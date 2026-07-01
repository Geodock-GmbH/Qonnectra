"""Tests for TypeOfWork, RequestReason and PipelineRecord models."""

import pytest

from apps.api.models import PipelineRecord, RequestReason, TypeOfWork

from ..factories import (
    PipelineRecordFactory,
    ProjectFactory,
    RequestReasonFactory,
    TypeOfWorkFactory,
)


@pytest.mark.django_db
class TestTypeOfWorkModel:
    """Tests for the TypeOfWork model."""

    def test_creation(self):
        tow = TypeOfWork.objects.create(name="Neubau")
        assert tow.id is not None
        assert tow.name == "Neubau"

    def test_str_representation(self):
        tow = TypeOfWork.objects.create(name="Reparatur")
        assert str(tow) == "Reparatur"


@pytest.mark.django_db
class TestRequestReasonModel:
    """Tests for the RequestReason model."""

    def test_creation(self):
        reason = RequestReason.objects.create(name="Bauanfrage")
        assert reason.id is not None
        assert reason.name == "Bauanfrage"

    def test_str_representation(self):
        reason = RequestReason.objects.create(name="Planauskunft")
        assert str(reason) == "Planauskunft"


@pytest.mark.django_db
class TestPipelineRecordModel:
    """Tests for the PipelineRecord model."""

    def test_creation_with_all_fields(self):
        project = ProjectFactory()
        tow = TypeOfWorkFactory()
        record = PipelineRecord.objects.create(
            project=project,
            type_of_work=tow,
            organisation="Test Org",
            name="Test Person",
            tel="0123456789",
            mobile="0171234567",
        )
        assert record.uuid is not None
        assert record.organisation == "Test Org"
        assert record.name == "Test Person"
        assert record.tel == "0123456789"
        assert record.mobile == "0171234567"
        assert record.created_at is not None
        assert record.modified_at is not None

    def test_str_returns_uuid(self):
        record = PipelineRecordFactory()
        assert str(record) == str(record.uuid)

    def test_cascade_delete_with_project(self):
        project = ProjectFactory()
        PipelineRecordFactory(project=project)
        assert PipelineRecord.objects.count() == 1
        project.delete()
        assert PipelineRecord.objects.count() == 0

    def test_type_of_work_set_null_on_delete(self):
        tow = TypeOfWorkFactory()
        record = PipelineRecordFactory(type_of_work=tow)
        tow.delete()
        record.refresh_from_db()
        assert record.type_of_work is None

    def test_optional_fields(self):
        project = ProjectFactory()
        record = PipelineRecord.objects.create(project=project)
        assert record.uuid is not None
        assert record.type_of_work is None
        assert record.request_reason is None
        assert record.organisation is None
        assert record.name is None
        assert record.tel is None
        assert record.mobile is None

    def test_has_history(self):
        record = PipelineRecordFactory()
        assert record.history.count() == 1

    def test_request_reason_set_null_on_delete(self):
        reason = RequestReasonFactory()
        record = PipelineRecordFactory(request_reason=reason)
        reason.delete()
        record.refresh_from_db()
        assert record.request_reason is None

    def test_creation_with_request_reason(self):
        project = ProjectFactory()
        reason = RequestReasonFactory(name="Bauanfrage")
        record = PipelineRecord.objects.create(
            project=project,
            request_reason=reason,
        )
        assert record.request_reason == reason
        assert record.request_reason.name == "Bauanfrage"
