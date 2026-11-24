# OpenAEO

See what AI says about your brand, and what to fix so it recommends you.

OpenAEO asks Claude, ChatGPT and other AI engines the questions your buyers ask, records who they recommend and which sites they cite, and audits your website for the things that stop AI from reading it. It runs on your own computer, on the AI subscriptions or API keys you already have. There is no account and nothing is sent to us.

## Install

macOS and Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/jdships/openaeo/main/deploy/installer/install.sh | sh
```

Then run:

```sh
openaeo
```

The dashboard opens in your browser. Enter your website, confirm your brand and competitors, connect an engine, and the first run starts.

## What it does

- **Answers.** Every answer from every engine, word for word, with the sites it relied on.
- **Visibility.** How often you are named, in what position, and how often your own site is cited, tracked over time.
- **Competitors and sources.** Who gets recommended beside you, and which outside sites the engines trust.
- **Opportunities.** Questions where a competitor is named and you are not.
- **Audit.** Checks your pages the way an AI crawler reads them: robots rules for AI bots, content without JavaScript, structured data, direct answers and more. Each finding comes with a fix.
- **Ask Aeo.** A built-in analyst that answers questions from your own runs and audit.

## Engines

| Engine     | How it connects                                                    |
| ---------- | ------------------------------------------------------------------ |
| Claude     | Claude Code subscription on this computer, or an Anthropic API key |
| ChatGPT    | Codex subscription on this computer, or an OpenAI API key          |
| Grok       | xAI API key                                                        |
| Gemini     | Google API key                                                     |
| Perplexity | Perplexity API key                                                 |

Each engine is asked with web search turned on. Results are close to, but not identical to, the consumer apps, which add their own memory and personalisation.

## Command line

```
openaeo                 Open the dashboard in your browser
openaeo run             Run all active prompts now and print a report
openaeo audit [url]     Check a website against AEO rules and print the findings
openaeo status          Show projects and which AI engines are available
openaeo mcp             Run the connection your AI agent uses

--project <name>        Project to run (default: the first one)
--json                  Print the report as JSON
--no-open               Start the dashboard without opening a browser
--port <number>         Port for the dashboard (default: 4747)
```

## Use it from your AI agent

OpenAEO exposes its reports and audit findings over MCP, so Claude Code or Codex can read them and fix problems in your site's code:

```sh
claude mcp add openaeo --scope user -- openaeo mcp
codex mcp add openaeo -- openaeo mcp
```

See [plugins/openaeo](plugins/openaeo/README.md) for the tools and ready-made skills.

## Your data

Everything is stored in `~/.openaeo` on your computer. Your questions go to the AI engines you connect, and the audit reads your public website. API keys stay on your computer.

## Repository layout

```
packages/engine     Asking engines, matching mentions, scoring, auditing. No storage, no server.
apps/local          The app: command line, local server, SQLite store and the web dashboard.
deploy/installer    The install script and its test.
plugins/openaeo     MCP documentation and agent skills.
```

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run typecheck
bun run test

cd apps/local
bun run build:web       # build the dashboard
bun run dev             # run the app from source
bun run build           # compile the single binary to dist/openaeo
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT, see [LICENSE](LICENSE). Some dashboard components are affectUI Pro files under their own licence; see [LICENSE-NOTES.md](LICENSE-NOTES.md).
