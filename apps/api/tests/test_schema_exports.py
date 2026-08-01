from weavance_api import schemas


def test_schema_package_preserves_capture_and_recommendation_exports() -> None:
    assert "CaptureCreate" in schemas.__all__
    assert "CaptureResponse" in schemas.__all__
    assert "RecommendationCreate" in schemas.__all__
    assert "RecommendationEpisodeResponse" in schemas.__all__
