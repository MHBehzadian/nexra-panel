"""add admin analytics tables

Revision ID: c5d2e7f9a1b3
Revises: b3e8f1a6c2d4
Create Date: 2026-11-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d2e7f9a1b3'
down_revision: Union[str, None] = 'b3e8f1a6c2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('admin_usage_hourly',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('admin_id', sa.Integer(), nullable=False),
    sa.Column('hour', sa.DateTime(), nullable=False),
    sa.Column('used', sa.BigInteger(), nullable=False, server_default='0'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('admin_id', 'hour')
    )
    op.create_index(op.f('ix_admin_usage_hourly_admin_id'), 'admin_usage_hourly', ['admin_id'], unique=False)
    op.create_index(op.f('ix_admin_usage_hourly_hour'), 'admin_usage_hourly', ['hour'], unique=False)

    op.create_table('admin_traffic_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('admin_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.BigInteger(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False, server_default='charge'),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_admin_traffic_log_admin_id'), 'admin_traffic_log', ['admin_id'], unique=False)
    op.create_index(op.f('ix_admin_traffic_log_created_at'), 'admin_traffic_log', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_admin_traffic_log_created_at'), table_name='admin_traffic_log')
    op.drop_index(op.f('ix_admin_traffic_log_admin_id'), table_name='admin_traffic_log')
    op.drop_table('admin_traffic_log')
    op.drop_index(op.f('ix_admin_usage_hourly_hour'), table_name='admin_usage_hourly')
    op.drop_index(op.f('ix_admin_usage_hourly_admin_id'), table_name='admin_usage_hourly')
    op.drop_table('admin_usage_hourly')
