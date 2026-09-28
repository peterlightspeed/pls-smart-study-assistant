"""core tables: categories, goals, study_sessions, notes, gallery_items, user_settings

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

NOW = sa.func.now()


def _id():
    return sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False)


def _ts():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def _pk(table, col="id"):
    return sa.PrimaryKeyConstraint(col, name=op.f(f"pk_{table}"))


def upgrade() -> None:
    categories = op.create_table(
        "categories", _id(),
        sa.Column("user_id", sa.Uuid()),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(9), server_default="#4F6BED", nullable=False),
        sa.Column("icon", sa.String(40), server_default="tag", nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_ts(), _pk("categories"),
        sa.UniqueConstraint("user_id", "name", name="uq_categories_user_id_name"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"])
    op.bulk_insert(categories, [
        {"name": n, "color": c, "icon": i, "is_default": True} for n, c, i in [
            ("Academic", "#4F6BED", "mortarboard"), ("Personal", "#A855F7", "person"),
            ("Coding", "#06B6D4", "code-slash"), ("Health", "#2E9E6B", "heart-pulse"),
            ("Career", "#E59F1F", "briefcase"), ("Study Planner", "#EC4899", "calendar-check"),
        ]
    ])

    op.create_table(
        "goals", _id(),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("category_id", sa.Uuid()),
        sa.Column("priority", sa.String(10), server_default="medium", nullable=False),
        sa.Column("scope", sa.String(12), server_default="daily", nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(10), server_default="active", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        *_ts(), _pk("goals"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=op.f("fk_goals_category_id_categories"), ondelete="SET NULL"),
        sa.CheckConstraint("priority in ('low','medium','high')", name=op.f("ck_goals_priority")),
        sa.CheckConstraint("scope in ('daily','weekly','long_term')", name=op.f("ck_goals_scope")),
        sa.CheckConstraint("status in ('active','completed','archived')", name=op.f("ck_goals_status")),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])
    op.create_index("ix_goals_user_status_due", "goals", ["user_id", "status", "due_at"])
    op.create_index("ix_goals_user_completed", "goals", ["user_id", "completed_at"])

    op.create_table(
        "study_sessions", _id(),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("goal_id", sa.Uuid()), sa.Column("category_id", sa.Uuid()),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("planned_minutes", sa.Integer(), nullable=False),
        sa.Column("actual_minutes", sa.Integer()),
        sa.Column("status", sa.String(12), server_default="planned", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text()),
        *_ts(), _pk("study_sessions"),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], name=op.f("fk_study_sessions_goal_id_goals"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=op.f("fk_study_sessions_category_id_categories"), ondelete="SET NULL"),
        sa.CheckConstraint("status in ('planned','in_progress','completed','skipped')", name=op.f("ck_study_sessions_status")),
        sa.CheckConstraint("planned_minutes > 0", name=op.f("ck_study_sessions_planned_minutes")),
    )
    op.create_index("ix_study_sessions_user_id", "study_sessions", ["user_id"])
    op.create_index("ix_study_sessions_user_start", "study_sessions", ["user_id", "scheduled_start"])
    op.create_index("ix_study_sessions_user_completed", "study_sessions", ["user_id", "completed_at"])

    op.create_table(
        "notes", _id(),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(200), server_default="Untitled", nullable=False),
        sa.Column("content", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("content_text", sa.Text(), server_default="", nullable=False),
        sa.Column("category_id", sa.Uuid()),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_ts(), _pk("notes"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=op.f("fk_notes_category_id_categories"), ondelete="SET NULL"),
    )
    op.create_index("ix_notes_user_id", "notes", ["user_id"])

    op.create_table(
        "gallery_items", _id(),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("item_type", sa.String(12), server_default="image", nullable=False),
        sa.Column("storage_path", sa.String(300), nullable=False),
        sa.Column("thumb_path", sa.String(300), nullable=False),
        sa.Column("mime_type", sa.String(50), server_default="image/webp", nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("original_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False), sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("tags", pg.ARRAY(sa.String(30)), server_default="{}", nullable=False),
        *_ts(), _pk("gallery_items"),
        sa.CheckConstraint("item_type in ('certificate','assignment','note','image')", name=op.f("ck_gallery_items_item_type")),
    )
    op.create_index("ix_gallery_items_user_id", "gallery_items", ["user_id"])
    op.create_index("ix_gallery_user_type_created", "gallery_items", ["user_id", "item_type", "created_at"])

    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("theme", sa.String(10), server_default="system", nullable=False),
        sa.Column("weekly_study_target_minutes", sa.Integer(), server_default="600", nullable=False),
        sa.Column("week_starts_on", sa.SmallInteger(), server_default="1", nullable=False),
        sa.Column("notifications_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("reminder_time", sa.Time()),
        *_ts(), _pk("user_settings", "user_id"),
        sa.CheckConstraint("theme in ('light','dark','system')", name=op.f("ck_user_settings_theme")),
    )


def downgrade() -> None:
    for t in ("user_settings", "gallery_items", "notes", "study_sessions", "goals", "categories"):
        op.drop_table(t)
