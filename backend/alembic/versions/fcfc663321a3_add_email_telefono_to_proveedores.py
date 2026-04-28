"""add_email_telefono_to_proveedores

Revision ID: fcfc663321a3
Revises: d8e4f6a2b3c5
Create Date: 2026-04-20 16:27:28.065199
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic
revision = 'fcfc663321a3'
down_revision = 'd8e4f6a2b3c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = [row[1] for row in conn.execute(sa.text("PRAGMA table_info(proveedores)"))]
    if "email" not in existing:
        conn.execute(sa.text("ALTER TABLE proveedores ADD COLUMN email TEXT"))
    if "telefono" not in existing:
        conn.execute(sa.text("ALTER TABLE proveedores ADD COLUMN telefono TEXT"))


def downgrade() -> None:
    pass
