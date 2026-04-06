"""base.py — Helpers comunes para todos los repositorios."""

from datetime import datetime
from typing import Any


def now_utc() -> datetime:
    return datetime.utcnow()


def to_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return now_utc()
    return now_utc()


def to_datetime_optional(value: Any):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def compute_estado(stock_actual: float, stock_min: float) -> str:
    if stock_actual == 0:
        return "Agotado"
    if stock_actual < stock_min:
        return "Poca existencia"
    return "Disponible"
