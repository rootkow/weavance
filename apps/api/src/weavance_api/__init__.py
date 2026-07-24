"""Weavance API package."""

from importlib.metadata import PackageNotFoundError, version

PACKAGE_NAME = "weavance-api"

try:
    __version__ = version(PACKAGE_NAME)
except PackageNotFoundError:
    __version__ = "0.0.0+unknown"
