# OpenAEO for AI agents

OpenAEO exposes its data to your own AI agent over MCP, so the agent can do what the dashboard does: read your AI visibility reports, answers, sources, opportunities and audit findings, manage the brand, competitors, questions and runs you track, and fix problems in your site's code.

## Connect

Install OpenAEO, then run one of these once:

```
claude mcp add openaeo --scope user -- openaeo mcp
codex mcp add openaeo -- openaeo mcp
```

To use OpenAEO Cloud instead of this computer, add the hosted server and sign in when asked:

```
claude mcp add --transport http openaeo https://openaeo.io/api/mcp
```

## Plugin

This folder is also a plugin for agents that install plugins, such as Cursor and Grok Bot. It bundles the skills below with the OpenAEO Cloud connection (`mcp.json`). The manifest is `.cursor-plugin/plugin.json`.

## Tools

| Tool                  | What it does                                                             |
| --------------------- | ------------------------------------------------------------------------ |
| `list_projects`       | Brands tracked on this computer                                          |
| `get_brand`           | A brand's name, websites, other names and location                       |
| `update_brand`        | Change a brand's location, websites, other names or name                 |
| `create_brand`        | Start tracking a new brand (then add questions and run)                  |
| `get_report`          | Visibility score, engines, competitors, trend, what AI says of the brand |
| `list_answers`        | What each AI engine answered, filtered by question, engine or mention    |
| `get_answer`          | One answer in full, with every page it cited                             |
| `get_opportunities`   | Questions the brand is missing from and sites worth being on             |
| `list_sources`        | Every site the engines cited, and which engines cited it                 |
| `get_audit`           | Latest website audit, its findings and what AI engines flagged           |
| `get_fix_brief`       | Instructions for fixing the findings, with starter files                 |
| `get_plan`            | The plan for getting recommended, step by step                           |
| `mark_plan_step`      | Mark a step of the plan done or not done                                 |
| `list_competitors`    | Tracked competitors, their websites and share of answers                 |
| `find_competitors`    | Ask your AI engine for likely competitors (saves nothing)                |
| `add_competitors`     | Track more competitors, counted from the next run                        |
| `remove_competitor`   | Stop tracking a competitor                                               |
| `list_questions`      | Tracked questions, active or paused, with mention rates                  |
| `suggest_questions`   | Ask your AI engine for question ideas (saves nothing)                    |
| `add_questions`       | Track more questions, asked in the next run                              |
| `set_question_active` | Pause or resume a question                                               |
| `set_question_tags`   | Group questions with tags                                                |
| `remove_question`     | Stop tracking a question; old runs keep its answers                      |
| `list_runs`           | Recent runs with status, answers, engines and errors                     |
| `run_prompts`         | Start a run (uses your AI subscriptions)                                 |
| `cancel_run`          | Stop the run in progress, keeping its answers so far                     |
| `get_schedule`        | Whether runs start on their own, and when the next is due                |
| `set_schedule`        | Turn automatic runs off, daily or weekly                                 |
| `run_audit`           | Audit a site, including a local address                                  |
| `list_posts`          | OpenAEO Cloud only: the Posts board, by column                           |
| `draft_post`          | OpenAEO Cloud only: save a post to Draft for the user to review          |
| `edit_post`           | OpenAEO Cloud only: change the text of a draft                           |
| `schedule_post`       | OpenAEO Cloud only: schedule an approved draft to be published           |
| `unschedule_post`     | OpenAEO Cloud only: move a scheduled post back to Draft                  |
| `archive_post`        | OpenAEO Cloud only: archive a draft or scheduled post                    |

## Skills

Copy a folder from `skills/` into your agent's skills directory (for Claude Code, `~/.claude/skills/`):

- `aeo-audit-fix`: fix audit findings in the site's source.
- `aeo-visibility-review`: explain where the brand stands and what to do.
- `aeo-content-brief`: plan a page for a question the brand is missing from.
- `aeo-outreach`: prepare replies, listings and posts for the sites the engines cite. It never publishes for you.

Text that comes from websites and from AI answers is passed to your agent as quoted data, with a notice to treat it as data and not as instructions.
