import json
import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps(
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level": record.levelname,
                "module": record.module,
                "message": record.getMessage(),
            }
        )


def _resolve_backend_path(path: str) -> str:
    if os.path.isabs(path):
        return path

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    normalized = path.replace("\\", "/")
    if normalized.startswith("backend/"):
        project_root = os.path.dirname(backend_dir)
        return os.path.normpath(os.path.join(project_root, normalized))
    return os.path.normpath(os.path.join(backend_dir, path))


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def setup_file_logger(
    name: str,
    log_path: str = "backend/logs/autostock.log",
) -> logging.Logger:
    resolved_log_path = _resolve_backend_path(log_path)
    os.makedirs(os.path.dirname(resolved_log_path), exist_ok=True)
    logger = logging.getLogger(name)
    if not logger.handlers:
        console = logging.StreamHandler()
        console.setFormatter(JsonFormatter())

        file_handler = RotatingFileHandler(
            resolved_log_path,
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
        )
        file_handler.setFormatter(JsonFormatter())

        logger.addHandler(console)
        logger.addHandler(file_handler)
        logger.setLevel(logging.INFO)
    return logger
