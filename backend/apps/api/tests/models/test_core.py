"""Tests for core models: Projects, Flags, Address, Area, ResidentialUnit, QGISProject."""

import pytest
from django.core.files.base import ContentFile
from django.contrib.gis.geos import Point, Polygon
from django.db import IntegrityError

from apps.api.models import (
    Address,
    Area,
    AttributesResidentialUnitStatus,
    AttributesResidentialUnitType,
    Flags,
    Projects,
    QGISProject,
    ResidentialUnit,
)

from ..factories import (
    AddressFactory,
    AreaTypeFactory,
    FlagFactory,
    ProjectFactory,
)


@pytest.mark.django_db
class TestProjectsModel:
    """Tests for the Projects model."""

    def test_project_creation(self):
        """Test creating a project."""
        project = Projects.objects.create(
            project="Test Project",
            description="A test project description",
            active=True,
        )
        assert project.project == "Test Project"
        assert project.description == "A test project description"
        assert project.active is True

    def test_project_str_representation(self):
        """Test project string representation."""
        project = ProjectFactory(project="My Project")
        assert str(project) == "My Project"

    def test_project_name_unique(self):
        """Test that project name must be unique."""
        Projects.objects.create(project="Unique Project", active=True)
        with pytest.raises(IntegrityError):
            Projects.objects.create(project="Unique Project", active=True)

    def test_project_default_active(self):
        """Test that projects are active by default."""
        project = Projects.objects.create(project="Default Active")
        assert project.active is True


@pytest.mark.django_db
class TestFlagsModel:
    """Tests for the Flags model."""

    def test_flag_creation(self):
        """Test creating a flag."""
        flag = Flags.objects.create(flag="Test Flag")
        assert flag.flag == "Test Flag"

    def test_flag_str_representation(self):
        """Test flag string representation."""
        flag = FlagFactory(flag="My Flag")
        assert str(flag) == "My Flag"

    def test_flag_name_unique(self):
        """Test that flag name must be unique."""
        Flags.objects.create(flag="Unique Flag")
        with pytest.raises(IntegrityError):
            Flags.objects.create(flag="Unique Flag")


@pytest.mark.django_db
class TestAddressModel:
    """Tests for the Address model."""

    def test_address_creation(self):
        """Test creating an address."""
        project = ProjectFactory()
        flag = FlagFactory()

        address = Address.objects.create(
            zip_code="24941",
            city="Flensburg",
            street="Teststraße",
            housenumber=42,
            geom=Point(9.45, 54.78, srid=25832),
            project=project,
            flag=flag,
        )

        assert address.uuid is not None
        assert address.city == "Flensburg"
        assert address.housenumber == 42

    def test_address_with_suffix(self):
        """Test address with house number suffix."""
        address = AddressFactory(
            housenumber=10,
            house_number_suffix="a",
        )

        assert address.housenumber == 10
        assert address.house_number_suffix == "a"


@pytest.mark.django_db
class TestAreaModel:
    """Tests for the Area model."""

    def test_area_creation(self):
        """Test creating an area with polygon geometry."""
        project = ProjectFactory()
        flag = FlagFactory()
        area_type = AreaTypeFactory()

        polygon = Polygon(((0, 0), (100, 0), (100, 100), (0, 100), (0, 0)), srid=25832)

        area = Area.objects.create(
            name="Test Area",
            area_type=area_type,
            geom=polygon,
            project=project,
            flag=flag,
        )

        assert area.uuid is not None
        assert area.name == "Test Area"
        assert area.area_type == area_type


@pytest.mark.django_db
class TestResidentialUnitModel:
    """Tests for the ResidentialUnit model."""

    def test_residential_unit_creation(self):
        """Test creating a residential unit."""
        address = AddressFactory()
        unit = ResidentialUnit.objects.create(
            uuid_address=address,
            floor=2,
            side="left",
        )
        assert unit.uuid is not None
        assert unit.uuid_address == address
        assert unit.floor == 2

    def test_residential_unit_str_representation(self):
        """Test residential unit string representation."""
        address = AddressFactory(street="Teststraße", housenumber=10)
        unit = ResidentialUnit.objects.create(
            uuid_address=address,
            floor=1,
            side="right",
        )
        assert str(unit) is not None

    def test_residential_unit_with_type_and_status(self):
        """Test residential unit with type and status."""
        address = AddressFactory()
        unit_type = AttributesResidentialUnitType.objects.create(
            residential_unit_type="Wohnung"
        )
        status = AttributesResidentialUnitStatus.objects.create(status="Vermietet")

        unit = ResidentialUnit.objects.create(
            uuid_address=address,
            residential_unit_type=unit_type,
            status=status,
        )
        assert unit.residential_unit_type == unit_type
        assert unit.status == status


@pytest.mark.django_db
class TestQGISProjectModel:
    """Tests for QGISProject model methods."""

    def test_get_wfs3_url(self, user):
        """Should return correct WFS3 URL."""
        project = QGISProject.objects.create(
            name="test-project",
            display_name="Test Project",
            description="A test project",
            created_by=user,
        )
        project.project_file.save("test-project.qgz", ContentFile(b"fake qgz content"))

        url = project.get_wfs3_url()
        assert url == f"/api/v1/wfs3/{project.name}/"

    def test_map_path_property(self, user):
        """Should return correct MAP path."""
        project = QGISProject.objects.create(
            name="test-project",
            display_name="Test Project",
            description="A test project",
            created_by=user,
        )
        project.project_file.save("test-project.qgz", ContentFile(b"fake qgz content"))

        map_path = project.map_path
        assert map_path == f"/projects/{project.name}.qgz"
