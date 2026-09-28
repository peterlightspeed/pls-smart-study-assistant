"""Server-side image validation + re-encoding. The client compresses first; we never trust its output."""
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

Image.MAX_IMAGE_PIXELS = 50_000_000  # decompression-bomb guard
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
MAIN_MAX, THUMB_MAX = 1600, 400


@dataclass
class ProcessedImage:
    main: bytes
    thumb: bytes
    width: int
    height: int


def _encode(img: Image.Image, max_side: int, quality: int) -> tuple[bytes, tuple[int, int]]:
    copy = img.copy()
    copy.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = BytesIO()
    copy.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue(), copy.size


def process_image(data: bytes) -> ProcessedImage:
    try:
        probe = Image.open(BytesIO(data))
        if probe.format not in ALLOWED_FORMATS:
            raise AppError(415, "unsupported_image", "Use a JPEG, PNG, WebP or GIF image.")
        img = ImageOps.exif_transpose(Image.open(BytesIO(data)))  # also drops EXIF/GPS on re-encode
        img.load()
    except AppError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise AppError(415, "invalid_image", "That file isn't a valid image.") from None
    img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    main, size = _encode(img, MAIN_MAX, 80)
    thumb, _ = _encode(img, THUMB_MAX, 70)
    return ProcessedImage(main, thumb, size[0], size[1])
