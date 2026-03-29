"""Tool registry for dynamic tool management."""

import json
from typing import Any

from marketbot.agent.tools.base import Tool


class ToolRegistry:
    """
    Registry for agent tools.

    Allows dynamic registration and execution of tools.
    """

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool."""
        self._tools[tool.name] = tool

    def unregister(self, name: str) -> None:
        """Unregister a tool by name."""
        self._tools.pop(name, None)

    def get(self, name: str) -> Tool | None:
        """Get a tool by name."""
        return self._tools.get(name)

    def has(self, name: str) -> bool:
        """Check if a tool is registered."""
        return name in self._tools

    def get_definitions(self, *, exposed_names: set[str] | None = None) -> list[dict[str, Any]]:
        """Get tool definitions in OpenAI format, optionally filtered by visibility."""
        return [
            tool.to_schema()
            for name, tool in self._tools.items()
            if exposed_names is None or name in exposed_names
        ]

    async def execute(self, name: str, params: dict[str, Any]) -> str:
        """Execute a tool by name with given parameters."""
        tool = self._tools.get(name)
        if not tool:
            return self._format_error(
                name=name,
                error_type="tool_not_found",
                message=f"Tool '{name}' not found.",
                retryable=False,
                details={"available": self.tool_names},
            )

        try:
            # Attempt to cast parameters to match schema types
            params = tool.cast_params(params)
            
            # Validate parameters
            errors = tool.validate_params(params)
            if errors:
                return self._format_error(
                    name=name,
                    error_type="invalid_parameters",
                    message="; ".join(errors),
                    retryable=True,
                    details={"params": params},
                )
            result = await tool.execute(**params)
            if isinstance(result, str) and result.startswith("Error"):
                return self._format_error(
                    name=name,
                    error_type="tool_execution_failed",
                    message=result,
                    retryable=True,
                )
            return result
        except Exception as e:
            return self._format_error(
                name=name,
                error_type="tool_exception",
                message=str(e),
                retryable=True,
            )

    @staticmethod
    def _format_error(
        *,
        name: str,
        error_type: str,
        message: str,
        retryable: bool,
        details: dict[str, Any] | None = None,
    ) -> str:
        """Return a structured tool error payload instead of free-form text."""
        payload = {
            "ok": False,
            "schema_version": "1",
            "error": {
                "tool": name,
                "type": error_type,
                "message": str(message),
                "retryable": bool(retryable),
                "hint": "Inspect arguments or choose a different healthy tool.",
            },
        }
        if details:
            payload["error"]["details"] = details
        return json.dumps(payload, ensure_ascii=False)

    @property
    def tool_names(self) -> list[str]:
        """Get list of registered tool names."""
        return list(self._tools.keys())

    def __len__(self) -> int:
        return len(self._tools)

    def __contains__(self, name: str) -> bool:
        return name in self._tools
