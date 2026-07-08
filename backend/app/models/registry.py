class ModelRegistry:
    """Placeholder for startup-loaded CV models used by later phases."""

    def __init__(self) -> None:
        self.detector = None
        self.segmenter = None

    @property
    def ready(self) -> bool:
        return self.detector is not None and self.segmenter is not None
