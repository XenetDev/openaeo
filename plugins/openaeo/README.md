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
| `get_competitor`      | Why one competitor gets named: questions, quotes, sites and pages        |
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

The tools above let an agent read and change your OpenAEO data. A skill tells it how to do a whole job with them. Without the skills an agent can still answer questions; with them it knows the steps, the order and where to stop for you.

| Skill                   | Use it when you want to                                                   | Needs                                  |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| `aeo-work-the-plan`     | Work through the whole plan. Start here; it uses the others for each step | Any agent                              |
| `aeo-visibility-review` | Understand where the brand stands and why                                 | Any agent                              |
| `aeo-audit-fix`         | Fix the website problems the audit found                                  | Your site's code, or its CMS           |
| `aeo-content-brief`     | Plan a page for a question the brand is missing from                      | Any agent                              |
| `aeo-profiles`          | Make the facts about the brand match across its site and profiles         | An agent with a browser                |
| `aeo-outreach`          | Prepare replies, listing requests and posts for the sites engines cite    | A browser; OpenAEO Cloud for the board |

Every skill works with the local app and with OpenAEO Cloud. The Posts board, and the tools that draft and schedule posts, exist only in OpenAEO Cloud; with the local app the outreach skill gives you the text to post yourself.

No skill publishes for you. Posts, replies, emails, profile changes and form submissions all stop for your yes.

### Add the skills to your agent

**Any agent with web access** (Grok Bot, ChatGPT, Claude and others): connect OpenAEO first, then paste this into a chat.

```
Read each of these and save it as a skill with the same name. Follow them exactly, including the rules at the end.
https://raw.githubusercontent.com/xenetdev/openaeo/main/plugins/openaeo/skills/aeo-work-the-plan/SKILL.md
https://raw.githubusercontent.com/xenetdev/openaeo/main/plugins/openaeo/skills/aeo-visibility-review/SKILL.md
https://raw.githubusercontent.com/xenetdev/openaeo/main/plugins/openaeo/skills/aeo-audit-fix/SKILL.md
https://raw.githubusercontent.com/xenetdev/openaeo/main/plugins/openaeo/skills/aeo-content-brief/SKILL.md
https://raw.githubusercontent.com/xenetdev/openaeo/main/plugins/openaeo/skills/aeo-profiles/SKILL.md
https://raw.githubusercontent.com/xenetdev/openaeo/main/plugins/openaeo/skills/aeo-outreach/SKILL.md
```

If your agent cannot save skills, paste the same message at the start of a chat and it will follow them for that chat.

**Claude Code and Codex**: copy the folders into your skills directory.

```
git clone --depth 1 https://github.com/xenetdev/openaeo /tmp/openaeo
cp -R /tmp/openaeo/plugins/openaeo/skills/* ~/.claude/skills/
```

For Codex, copy them to `~/.agents/skills/` instead.

**Cursor and Grok Bot plugin**: this folder is a plugin (see above), so installing it adds the skills and the OpenAEO Cloud connection together.

### Use them

Then ask for the job in plain words. For example:

- "Use the aeo-work-the-plan skill for my brand."
- "Why does ChatGPT not recommend us?"
- "Fix the audit findings in this repo."
- "Write this week's posts and show me before scheduling."

Text that comes from websites and from AI answers is passed to your agent as quoted data, with a notice to treat it as data and not as instructions.
