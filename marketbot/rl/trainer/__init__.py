"""Trainer adapters for external RL stacks."""

from marketbot.rl.trainer.adapter import (
    JsonlSupervisedTrainerAdapter,
    SlimeJsonlTrainerAdapter,
    TrainingRunSummary,
    get_trainer_adapter,
)
from marketbot.rl.trainer.openclaw_export import (
    OpenClawExportSummary,
    detect_openclaw_root,
    export_openclaw_bundle,
)

__all__ = [
    "JsonlSupervisedTrainerAdapter",
    "OpenClawExportSummary",
    "SlimeJsonlTrainerAdapter",
    "TrainingRunSummary",
    "detect_openclaw_root",
    "export_openclaw_bundle",
    "get_trainer_adapter",
]
