---
name: engram
description: Provides semantic search for a local knowledge base using Pinecone and Gemini embeddings.
---

# 🧠 Engram - Semantic Search Skill

This skill enables an AI agent to perform semantic searches on a local folder of Markdown files (e.g., an Obsidian vault). It finds information based on the meaning and context of a query, not just exact keywords.

## Tools

### engram_search

Searches the indexed knowledge base.

-   **`query`** (string, required): The natural language question to ask.
-   **`top_k`** (number, optional): The number of results to return.
-   **`min_score`** (number, optional): The minimum relevance score (0.0 to 1.0) for results.

### engram_index

Builds or updates the search index from the local Markdown files. This tool should be run periodically to keep the search memory synchronized.

## Author

-   **Andrie Wijaya** ([@Anwitch](https://github.com/Anwitch))
