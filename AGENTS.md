# CloseSnow Agent Notes

- For routine local static validation and preview commands, use `python3 -m src.cli static --output-dir ... --max-workers 8` unless the user explicitly asks for a lower worker count.
- Treat older ledger entries that mention `--max-workers 2` as historical throttled runs, not the current working convention for Codex.
