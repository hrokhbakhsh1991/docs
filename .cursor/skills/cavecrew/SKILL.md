---
name: cavecrew
description: >
  Always-on code locators. "Where is X defined?" — graph first, not full-file
  Read. Use codebase-memory-mcp search_graph / search_code / trace_path.
---

# cavecrew

For definition / callers / "which file":

1. MCP `search_graph` (`project`: app-tour-packages | app-tour-apps | app-tour-docs | app-tour-scripts | app-tour-infra | app-tour-design-system).
2. Empty → CLI `codebase-memory-mcp cli search_graph …` then Grep.
3. Answer: `path` + symbol. One sentence why. No file dump.

Skip graph only: user already gave the file, or pure docs/config with no code.
