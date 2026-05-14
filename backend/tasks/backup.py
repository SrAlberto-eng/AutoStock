import os
import shutil
from datetime import datetime

from logging_config import setup_logger

logger = setup_logger("backup")


def backup_database(db_path: str, backup_dir: str | None = None) -> str:
    if backup_dir is None:
        import config
        backup_dir = config.BACKUP_DIR

    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(backup_dir, f"autostock_{timestamp}.db")
    shutil.copy2(db_path, dest)
    logger.info(f"Backup creado: {dest}")

    backups = sorted([f for f in os.listdir(backup_dir) if f.endswith(".db")])
    while len(backups) > 7:
        os.remove(os.path.join(backup_dir, backups.pop(0)))

    return dest
