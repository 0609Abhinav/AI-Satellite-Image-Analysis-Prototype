import json
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.core.config import settings


class Database:
    def __init__(self, url: str) -> None:
        self.url = url
        self._initialized = False

    def connect(self) -> psycopg.Connection:
        return psycopg.connect(self.url, row_factory=dict_row)

    def init(self) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS images (
                    id TEXT PRIMARY KEY,
                    original_name TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    capture_date TEXT,
                    source_provider TEXT,
                    source_note TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            self._ensure_column(conn, "images", "capture_date", "TEXT")
            self._ensure_column(conn, "images", "source_provider", "TEXT")
            self._ensure_column(conn, "images", "source_note", "TEXT")
            self._ensure_column(conn, "images", "bucket_name", "TEXT")
            self._ensure_column(conn, "images", "object_key", "TEXT")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analyses (
                    id TEXT PRIMARY KEY,
                    image_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS comparisons (
                    id TEXT PRIMARY KEY,
                    before_image_id TEXT NOT NULL,
                    after_image_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()
        self._initialized = True

    def _ensure_ready(self) -> None:
        if not self._initialized:
            self.init()

    def _ensure_column(self, conn: psycopg.Connection, table: str, column: str, definition: str) -> None:
        columns = {
            row["column_name"]
            for row in conn.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = %s
                """,
                (table,),
            ).fetchall()
        }
        if column not in columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> None:
        self._ensure_ready()
        with self.connect() as conn:
            conn.execute(self._postgres_query(query), params)
            conn.commit()

    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        self._ensure_ready()
        with self.connect() as conn:
            row = conn.execute(self._postgres_query(query), params).fetchone()
        return row

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        self._ensure_ready()
        with self.connect() as conn:
            rows = conn.execute(self._postgres_query(query), params).fetchall()
        return list(rows)

    @staticmethod
    def _postgres_query(query: str) -> str:
        return query.replace("?", "%s")

    @staticmethod
    def dumps(value: dict[str, Any]) -> str:
        return json.dumps(value, separators=(",", ":"))

    @staticmethod
    def loads(value: str | None) -> dict[str, Any] | None:
        return json.loads(value) if value else None


db = Database(settings.database_url)
