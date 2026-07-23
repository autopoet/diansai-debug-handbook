from peewee import CharField, IntegerField
from playhouse.migrate import SchemaMigrator, migrate

from app.db.database import database
from app.models.user import User


def migrate_revision_governance() -> None:
    if "article_revisions" not in database.get_tables():
        return

    columns = {column.name for column in database.get_columns("article_revisions")}
    migrator = SchemaMigrator.from_database(database)
    operations = []
    if "source_revision_id" not in columns:
        operations.append(
            migrator.add_column(
                "article_revisions",
                "source_revision_id",
                IntegerField(null=True),
            )
        )
    if "origin" not in columns:
        operations.append(
            migrator.add_column(
                "article_revisions",
                "origin",
                CharField(max_length=24, default="community"),
            )
        )
    if operations:
        migrate(*operations)


def ensure_single_admin() -> None:
    admins = list(User.select().where(User.role == "admin").order_by(User.id))
    if admins:
        if len(admins) > 1:
            (
                User.update(role="reviewer")
                .where(User.id.in_([user.id for user in admins[1:]]))
                .execute()
            )
        return

    first_user = (
        User.select().order_by((User.role == "reviewer").desc(), User.created_at, User.id).first()
    )
    if first_user is not None:
        first_user.role = "admin"
        first_user.save(only=[User.role])


def ensure_governance_indexes() -> None:
    database.execute_sql(
        "CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin ON users(role) WHERE role = 'admin'"
    )
    database.execute_sql(
        "CREATE UNIQUE INDEX IF NOT EXISTS revisions_symptom_version "
        "ON article_revisions(symptom_id, version_number)"
    )
