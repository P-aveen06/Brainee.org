import os
import re
from dataclasses import dataclass

from graphrag_sdk import ConnectionConfig


@dataclass(frozen=True)
class Settings:
    connection: ConnectionConfig
    token: str
    port: int = 3200

    @classmethod
    def from_env(cls):
        name = os.environ.get("GRAPH_NAME", "")
        if not re.fullmatch(r"brainee_(dev|test_[a-z0-9_]+)", name):
            raise ValueError("An explicit local graph name is required.")
        token = os.environ.get("GRAPH_SERVICE_TOKEN", "")
        password = os.environ.get("GRAPH_APP_PASSWORD", "")
        host = os.environ.get("GRAPH_HOST", "")
        if not host or len(token) < 32 or len(password) < 32:
            raise ValueError("Configure the private graph connection and service token.")
        return cls(ConnectionConfig(
            host=host, port=int(os.environ.get("GRAPH_PORT", "6379")),
            username="app", password=password, graph_name=name,
            retry_count=1, max_connections=8, query_timeout_ms=5000,
        ), token)

