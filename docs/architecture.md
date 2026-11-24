# Architecture

OpenAEO is one program that runs on the user's computer. It has two parts.

## `packages/engine`

Pure logic with no storage and no server, so it can be reused elsewhere.

- **Providers** ask an AI engine one question and return the answer, the sources it cited and usage. `src/cli` runs Claude Code and Codex as subprocesses; `src/providers` calls the OpenAI, Anthropic, xAI, Gemini and Perplexity APIs.
- **`run.ts`** asks many questions across many engines with a concurrency limit and retries.
- **`match.ts`** finds brand and competitor mentions and their order. **`score.ts`** turns them into mention rate, position, share of voice and a visibility score.
- **`audit/`** fetches a site through a guarded fetcher, checks each page against AEO rules, and produces findings, generated files and a fix brief.

The main entry never reaches subprocess or filesystem code; `test/exports.test.ts` enforces that.

## `apps/local`

- **`src/store`** is a SQLite database in `~/.openaeo`.
- **Services** (`runs.ts`, `audits.ts`, `scheduler.ts`) drive the engine and persist results. They take their dependencies as arguments.
- **`src/server`** is the local HTTP API. `handler.ts` applies the request guard and error mapping, `router.ts` matches routes, and `routes/` holds one file per area. Responses are typed against `src/api-types.ts`, which the dashboard imports, so the two cannot drift.
- **`src/mcp.ts`** exposes the same data to an AI agent, and **`src/cli.ts`** to the terminal.
- **`web/`** is the React dashboard. `App.tsx` composes hooks and components from `web/src/app/`; each page lives in `web/src/screens/`. It is built by Vite and embedded into the compiled binary.

## Trust boundaries

- **Local server.** Listens on `127.0.0.1` only. Requests need the right `Host`, a same-origin `Origin` when present, and a per-launch token.
- **Fetcher.** Public sites and this computer only; private networks and metadata addresses are refused, including by redirect.
- **Untrusted text.** Anything from a website or an AI answer reaches a model only as quoted lines under a notice to treat it as data. See `apps/local/src/ask.ts`.
- **Subprocesses.** Claude Code and Codex run with web search only, without the user's settings or MCP servers, in an empty temporary folder.

See [SECURITY.md](../SECURITY.md) for known limits.
