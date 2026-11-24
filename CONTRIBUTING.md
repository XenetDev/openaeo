# Contributing

Thanks for helping. Issues and pull requests are welcome.

## Set up

```sh
bun install
bun run typecheck
bun run test
```

To run the app from source:

```sh
cd apps/local
bun run build:web
bun run dev
```

## Before you open a pull request

- `bun run typecheck` and `bun run test` pass.
- New behaviour has a test. Engine parsing is tested against recorded output in `packages/engine/test/fixtures`.
- Keep `packages/engine` free of storage and server code so it can be reused.
- Text that comes from a website or from an AI answer must reach a model only as quoted data. See `apps/local/src/ask.ts` for the pattern.

## affectUI files

Files that start with the affectUI Pro notice are not MIT and must keep that notice. Do not copy them into other projects, and do not move them into a published package. See [LICENSE-NOTES.md](LICENSE-NOTES.md).

## Reporting bugs

Open an issue with what you did, what you expected and what happened. Include your operating system and the output of `openaeo --version`. Remove API keys and private data from anything you paste.
