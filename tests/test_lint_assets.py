from __future__ import annotations

from pathlib import Path

from scripts.lint_assets import REPO_ROOT, LintResult


def test_lint_result_renders_relative_path() -> None:
    result = LintResult(Path("assets/js"), "node is required")

    assert result.render() == "assets/js: node is required"


def test_lint_result_renders_repo_relative_absolute_path() -> None:
    result = LintResult(REPO_ROOT / "assets" / "js" / "weather_page.js", "syntax error")

    assert result.render() == "assets/js/weather_page.js: syntax error"
