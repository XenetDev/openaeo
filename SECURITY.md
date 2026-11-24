# Security

Please do not open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**.

Include what you found, how to reproduce it and which version you used. You will get a reply as soon as we can look at it.

## How the app protects itself

- The dashboard server listens on `127.0.0.1` only. Every request must carry the right `Host`, a same-origin `Origin` when one is sent, and a random token created each time the app starts.
- API keys are stored in `~/.openaeo` with owner-only permissions and are masked in every response.
- The website fetcher accepts `http` and `https` only, caps size, time and redirects, and refuses private, link-local and cloud metadata addresses. It may fetch a site on this computer (`localhost`, `127.0.0.1`, `::1`) so you can audit a development server, and it will not follow a redirect from a public site to this computer.
- Text from websites and from AI answers reaches a model only as quoted data, with a notice to treat it as data and not as instructions.
- Claude Code and Codex are started with web search only, without your own settings, hooks or MCP servers, in an empty temporary folder.

## Known limits

- The fetcher checks where a host name points and then connects in a second step. A host that changes its address between the two could slip past the private-address check.
- Local data is not encrypted. Anyone who can read your user account can read `~/.openaeo`.

## Scope

Reports about the local server, the stored API keys, the website fetcher, or content from websites and AI answers being treated as instructions are especially useful.
