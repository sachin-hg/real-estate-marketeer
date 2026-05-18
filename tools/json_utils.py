"""Shared utility: robustly extract the first JSON value from LLM output."""
from __future__ import annotations

import json
import re


def _fix_literal_newlines(s: str) -> str:
    """Replace literal newline/tab chars inside JSON string values with escape sequences."""
    result: list[str] = []
    in_string = False
    escape_next = False
    for char in s:
        if escape_next:
            result.append(char)
            escape_next = False
        elif char == "\\":
            result.append(char)
            escape_next = True
        elif char == '"':
            in_string = not in_string
            result.append(char)
        elif in_string and char == "\n":
            result.append("\\n")
        elif in_string and char == "\r":
            result.append("\\r")
        elif in_string and char == "\t":
            result.append("\\t")
        else:
            result.append(char)
    return "".join(result)


def extract_json(text: str):
    """
    Extract and parse the first valid JSON array or object from arbitrary text.
    Handles:
      - Clean JSON
      - Markdown-fenced JSON (```json ... ```)
      - JSON preceded or followed by prose
      - Literal newlines/tabs inside JSON string values (LLM formatting quirk)
    Returns parsed Python object or None on failure.
    """
    if not text:
        return None

    # 1. Try the raw text first (fast path for well-behaved models)
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 1b. Try with newline-in-string fix applied
    try:
        return json.loads(_fix_literal_newlines(text.strip()))
    except json.JSONDecodeError:
        pass

    # 2. Extract content from a markdown code fence if present
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        candidate = fence.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        try:
            return json.loads(_fix_literal_newlines(candidate))
        except json.JSONDecodeError:
            pass

    # 3. Find the first `[` or `{` and match to its closing bracket
    for open_char, close_char in [("[", "]"), ("{", "}")]:
        start = text.find(open_char)
        if start == -1:
            continue
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == open_char:
                depth += 1
            elif ch == close_char:
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        try:
                            return json.loads(_fix_literal_newlines(candidate))
                        except json.JSONDecodeError:
                            break  # malformed — try next open_char

    return None
