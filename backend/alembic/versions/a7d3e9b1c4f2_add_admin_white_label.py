"""add white_label and parent_id for admins

Revision ID: a7d3e9b1c4f2
Revises: c5d2e7f9a1b3
Create Date: 2026-11-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7d3e9b1c4f2'
down_revision: Union[str, None] = 'c5d2e7f9a1b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # No foreign key at the database level: SQLite can't add one to an existing
    # table without rebuilding it, and parent_id is only ever read as a hint.
    op.add_column('admins', sa.Column('parent_id', sa.Integer(), nullable=True))
    op.create_index('ix_admins_parent_id', 'admins', ['parent_id'])
    op.add_column(
        'admins',
        sa.Column('white_label', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_admins_parent_id', table_name='admins')
    with op.batch_alter_table('admins') as batch_op:
        batch_op.drop_column('white_label')
        batch_op.drop_column('parent_id')
