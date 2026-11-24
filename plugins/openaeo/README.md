# OpenAEO for AI agents

OpenAEO exposes its data to your own AI agent over MCP, so the agent can read your AI visibility reports and audit findings and fix problems in your site's code.

## Connect

Install OpenAEO, then run one of these once:

```
claude mcp add openaeo --scope user -- openaeo mcp
codex mcp add openaeo -- openaeo mcp
```

## Tools

| Tool | What it does |
| --- | --- |
| `list_projects` | Brands tracked on this computer |
| `get_report` | Visibility score, per-engine split, competitors, cited sites |
| `list_answers` | What each AI engine answered in the latest run |
| `get_audit` | Latest website audit and its findings |
| `get_fix_brief` | Instructions for fixing the audit findings |
| `run_prompts` | Start a run (uses your AI subscriptions) |
| `run_audit` | Audit a site, including a local address |

## Skills

Copy a folder from `skills/` into your agent's skills directory (for Claude Code, `~/.claude/skills/`):

- `aeo-audit-fix`: fix audit findings in the site's source.
- `aeo-visibility-review`: explain where the brand stands and what to do.
- `aeo-content-brief`: plan a page for a question the brand is missing from.

Text that comes from websites and from AI answers is passed to your agent as quoted data, with a notice to treat it as data and not as instructions.
