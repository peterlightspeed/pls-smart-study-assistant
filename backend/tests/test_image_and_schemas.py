from io import BytesIO

import pytest
from PIL import Image
from pydantic import ValidationError

from app.core.errors import AppError
from app.schemas.goal import GoalCreate
from app.schemas.profile import ProfileUpdate
from app.utils.image import process_image


def _png(size=(3000, 2000)):
    buf = BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, "PNG")
    return buf.getvalue()


def test_image_is_resized_and_reencoded_to_webp():
    out = process_image(_png())
    assert max(out.width, out.height) == 1600
    assert Image.open(BytesIO(out.main)).format == "WEBP"
    assert max(Image.open(BytesIO(out.thumb)).size) == 400
    assert len(out.main) < len(_png())


def test_non_image_is_rejected():
    with pytest.raises(AppError) as e:
        process_image(b"definitely not an image")
    assert e.value.status_code == 415


def test_goal_requires_timezone_aware_deadline():
    with pytest.raises(ValidationError):
        GoalCreate(title="x", due_at="2026-09-30T17:00:00")
    assert GoalCreate(title=" x ", due_at="2026-09-30T17:00:00Z").title == "x"


def test_profile_timezone_validation():
    assert ProfileUpdate(timezone="Africa/Lagos").timezone == "Africa/Lagos"
    with pytest.raises(ValidationError):
        ProfileUpdate(timezone="Mars/Base")
