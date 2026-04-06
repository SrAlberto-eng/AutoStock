import os
import shutil
from datetime import datetime

from logging_config import setup_logger

logger = setup_logger("backup")


def backup_database(db_path: str, backup_dir: str = "backend/backups"):
    if not os.path.isabs(backup_dir):
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        normalized = backup_dir.replace("\\", "/")
        if normalized.startswith("backend/"):
            project_root = os.path.dirname(backend_dir)
            backup_dir = os.path.normpath(os.path.join(project_root, normalized))
        else:
            backup_dir = os.path.normpath(os.path.join(backend_dir, backup_dir))

    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dest = f"{backup_dir}/autostock_{timestamp}.db"
    shutil.copy2(db_path, dest)
    logger.info(f"Backup creado: {dest}")

    backups = sorted([f for f in os.listdir(backup_dir) if f.endswith(".db")])
    while len(backups) > 7:
        os.remove(os.path.join(backup_dir, backups.pop(0)))

    return dest
