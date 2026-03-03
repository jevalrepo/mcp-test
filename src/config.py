from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Servidor MCP
    mcp_host: str = Field(default="0.0.0.0", alias="MCP_HOST")
    mcp_port: int = Field(default=8000, alias="MCP_PORT")
    mcp_server_name: str = Field(default="mcp-banorte", alias="MCP_SERVER_NAME")

    # Base de datos
    database_url: str = Field(
        default="sqlite+aiosqlite:///./data/mcp.db",
        alias="DATABASE_URL",
    )

    # Directorios
    files_base_dir: str = Field(default="./data", alias="FILES_BASE_DIR")
    output_dir: str = Field(default="./output", alias="OUTPUT_DIR")

    # APIs externas
    banorte_api_base_url: str = Field(default="", alias="BANORTE_API_BASE_URL")
    banorte_api_key: str = Field(default="", alias="BANORTE_API_KEY")
    banorte_api_secret: str = Field(default="", alias="BANORTE_API_SECRET")
    banorte_timeout: int = Field(default=30, alias="BANORTE_TIMEOUT")

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    class Config:
        env_file = ".env"
        populate_by_name = True


settings = Settings()
