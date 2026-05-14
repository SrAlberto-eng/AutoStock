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
    log_file: str = "autostock.log",
) -> logging.Logger:
    import config  # import diferido para evitar circular en import-time
    log_path = os.path.join(config.LOG_DIR, log_file)
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    logger = logging.getLogger(name)
    if not logger.handlers:
        console = logging.StreamHandler()
        console.setFormatter(JsonFormatter())

        file_handler = RotatingFileHandler(
            log_path,
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
        )
        file_handler.setFormatter(JsonFormatter())

        logger.addHandler(console)
        logger.addHandler(file_handler)
        logger.setLevel(logging.INFO)
    return logger
