"""audit.py — Wrapper de auditoria (delega a repositories.audit_repo)."""

from repositories.audit_repo import log_audit

__all__ = ["log_audit"]
