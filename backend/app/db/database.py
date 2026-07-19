from collections.abc import Generator

from peewee import Database
from playhouse.db_url import connect

from app.core.config import settings

database: Database = connect(settings.database_url)


def database_connection() -> Generator[None, None, None]:
    with database.connection_context():
        yield

