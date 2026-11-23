"""add can_create_subpanels for admins

Revision ID: b8e4f2a6d1c9
Revises: a7d3e9b1c4f2
Create Date: 2026-11-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e4f2a6d1c9'
down_revision: Union[str, None] = 'a7d3e9b1c4f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'admins',
        sa.Column('can_create_subpanels', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('admins') as batch_op:
        batch_op.drop_column('can_create_subpanels')
