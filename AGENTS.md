# CloseSnow Agent Notes

- For routine local static validation and preview commands, use `python3 -m src.cli static --output-dir ... --max-workers 8` unless the user explicitly asks for a lower worker count.
- Keep independent changes in focused PRs. Frontend changes should include a deploy preview and checks against the synthetic weather scenarios from `scripts/build_theme_preview.py`.
- Shared Day/Night colors live in `assets/css/design_system.css`; tables and charts should reference that palette.
