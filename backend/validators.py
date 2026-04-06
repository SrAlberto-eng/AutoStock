"""Validadores server-side para reglas de negocio de AutoStock.

Todos los validadores retornan ``bool`` y no lanzan excepciones.
"""

from __future__ import annotations

import re
import time
from datetime import datetime

# Regex de email con enfoque RFC 5322 basico: usuario@dominio.ext
EMAIL_REGEX = re.compile(
  r"^(?=.{1,255}$)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
  r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
  r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)


def validate_email(email: str) -> bool:
  """Valida formato basico de email y longitud maxima de 255."""
  if not isinstance(email, str):
    return False
  if not email or len(email) > 255:
    return False
  return EMAIL_REGEX.fullmatch(email) is not None


def validate_password_strength(password: str) -> bool:
  """Valida password minima: 6 chars, al menos una letra y un numero."""
  if not isinstance(password, str):
    return False
  if len(password) < 6:
    return False
  has_letter = any(char.isalpha() for char in password)
  has_digit = any(char.isdigit() for char in password)
  return has_letter and has_digit


def validate_stock_non_negative(stock: int | float) -> bool:
  """Retorna True solo si stock es numerico y mayor o igual a cero."""
  if isinstance(stock, bool):
    return False
  if not isinstance(stock, (int, float)):
    return False
  return stock >= 0


def validate_merma_motivo(motivo: str | None) -> bool:
  """Valida que motivo exista y no sea vacio/solo espacios."""
  if motivo is None:
    return False
  if not isinstance(motivo, str):
    return False
  return motivo.strip() != ""


def validate_login_not_blocked(bloqueado_hasta: datetime | None) -> bool:
  """Retorna True cuando no hay bloqueo activo."""
  if bloqueado_hasta is None:
    return True
  if not isinstance(bloqueado_hasta, datetime):
    return False
  now = (
    datetime.now(tz=bloqueado_hasta.tzinfo)
    if bloqueado_hasta.tzinfo is not None
    else datetime.now()
  )
  return not (bloqueado_hasta > now)


def validate_reversion_same_day(fecha_movimiento: datetime) -> bool:
  """Permite reversion solo para movimientos del dia actual."""
  if not isinstance(fecha_movimiento, datetime):
    return False
  today = (
    datetime.now(tz=fecha_movimiento.tzinfo).date()
    if fecha_movimiento.tzinfo is not None
    else datetime.now().date()
  )
  return fecha_movimiento.date() == today


def validate_jwt_not_expired(expires_at: int) -> bool:
  """Valida que el timestamp de expiracion aun no haya vencido."""
  if isinstance(expires_at, bool):
    return False
  if not isinstance(expires_at, (int, float)):
    return False
  return time.time() < float(expires_at)
