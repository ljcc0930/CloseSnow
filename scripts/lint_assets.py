#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

try:
    import tinycss2
except ImportError:  # pragma: no cover - exercised by shell scripts before CI install
    tinycss2 = None


REPO_ROOT = Path(__file__).resolve().parents[1]
VOID_HTML_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


@dataclass
class LintResult:
    path: Path
    message: str

    def render(self) -> str:
        return f"{self.path.relative_to(REPO_ROOT)}: {self.message}"


class BalancedHtmlParser(HTMLParser):
    def __init__(self, path: Path) -> None:
        super().__init__(convert_charrefs=False)
        self.path = path
        self.stack: list[tuple[str, int]] = []
        self.errors: list[LintResult] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        normalized = tag.lower()
        if normalized not in VOID_HTML_TAGS:
            self.stack.append((normalized, self.getpos()[0]))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del tag, attrs

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.lower()
        if normalized in VOID_HTML_TAGS:
            return
        if not self.stack:
            self.errors.append(LintResult(self.path, f"line {self.getpos()[0]}: unexpected closing </{normalized}>"))
            return
        open_tag, open_line = self.stack.pop()
        if open_tag != normalized:
            self.errors.append(
                LintResult(
                    self.path,
                    f"line {self.getpos()[0]}: closing </{normalized}> does not match <{open_tag}> opened on line {open_line}",
                )
            )

    def close(self) -> None:
        super().close()
        for tag, line in reversed(self.stack):
            self.errors.append(LintResult(self.path, f"line {line}: unclosed <{tag}>"))


def git_files(pattern: str) -> list[Path]:
    output = subprocess.check_output(["git", "ls-files", pattern], cwd=REPO_ROOT, text=True)
    return [REPO_ROOT / line for line in output.splitlines() if line]


def lint_js(paths: list[Path]) -> list[LintResult]:
    if not paths:
        return []
    node = shutil.which("node")
    if not node:
        return [LintResult(Path("assets/js"), "node is required for JavaScript syntax checks")]
    errors: list[LintResult] = []
    for path in paths:
        result = subprocess.run([node, "--check", str(path)], cwd=REPO_ROOT, text=True, capture_output=True)
        if result.returncode:
            message = (result.stderr or result.stdout).strip().splitlines()[0]
            errors.append(LintResult(path, message))
    return errors


def _css_parse_errors(path: Path, nodes: list[object]) -> list[LintResult]:
    errors: list[LintResult] = []
    for node in nodes:
        node_type = getattr(node, "type", "")
        if node_type == "error":
            line = getattr(node, "source_line", "?")
            message = getattr(node, "message", "CSS parse error")
            errors.append(LintResult(path, f"line {line}: {message}"))
        elif node_type == "qualified-rule":
            declarations = tinycss2.parse_declaration_list(node.content, skip_comments=True, skip_whitespace=True)
            errors.extend(_css_parse_errors(path, declarations))
        elif node_type == "at-rule" and getattr(node, "content", None):
            nested_rules = tinycss2.parse_rule_list(node.content, skip_comments=True, skip_whitespace=True)
            errors.extend(_css_parse_errors(path, nested_rules))
    return errors


def lint_css(paths: list[Path]) -> list[LintResult]:
    if not paths:
        return []
    if tinycss2 is None:
        return [LintResult(Path("assets/css"), "tinycss2 is required for CSS syntax checks")]
    errors: list[LintResult] = []
    for path in paths:
        content = path.read_text(encoding="utf-8")
        rules = tinycss2.parse_stylesheet(content, skip_comments=True, skip_whitespace=True)
        errors.extend(_css_parse_errors(path, rules))
    return errors


def lint_html(paths: list[Path]) -> list[LintResult]:
    errors: list[LintResult] = []
    for path in paths:
        parser = BalancedHtmlParser(path)
        try:
            parser.feed(path.read_text(encoding="utf-8"))
            parser.close()
        except Exception as exc:  # HTMLParser can raise on malformed declarations.
            errors.append(LintResult(path, str(exc)))
        errors.extend(parser.errors)
    return errors


def lint_shell(paths: list[Path]) -> list[LintResult]:
    errors: list[LintResult] = []
    for path in paths:
        result = subprocess.run(["bash", "-n", str(path)], cwd=REPO_ROOT, text=True, capture_output=True)
        if result.returncode:
            message = (result.stderr or result.stdout).strip().splitlines()[0]
            errors.append(LintResult(path, message))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Lint CloseSnow non-Python assets.")
    parser.add_argument("--js", action="store_true", help="Lint tracked JavaScript files")
    parser.add_argument("--css", action="store_true", help="Lint tracked CSS files")
    parser.add_argument("--html", action="store_true", help="Lint tracked HTML files")
    parser.add_argument("--shell", action="store_true", help="Lint tracked shell files")
    args = parser.parse_args()

    selected = args.js or args.css or args.html or args.shell
    lint_all = not selected
    errors: list[LintResult] = []

    if lint_all or args.js:
        errors.extend(lint_js(git_files("assets/js/*.js")))
    if lint_all or args.css:
        errors.extend(lint_css(git_files("assets/css/*.css")))
    if lint_all or args.html:
        html_paths = git_files("*.html") + git_files("example/*.html") + git_files("src/web/templates/*.html")
        errors.extend(lint_html(html_paths))
    if lint_all or args.shell:
        errors.extend(lint_shell(git_files("scripts/*.sh") + git_files(".githooks/*")))

    if errors:
        for error in errors:
            print(error.render(), file=sys.stderr)
        return 1

    print("Asset lint passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
