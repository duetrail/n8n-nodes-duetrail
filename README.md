# n8n-nodes-duetrail

An [n8n](https://n8n.io) community node for [DueTrail](https://duetrail.com) — review-first overdue-invoice collections for B2B service teams.

Two nodes over the DueTrail public API:

- **DueTrail Trigger** — starts a workflow on collection events: promises made and broken, payments recorded, cases settled, portal replies ("I already paid", questions) and reminders sent.
- **DueTrail** — Create Invoice, Record Payment, Add Note to Case.

## Installation

**Self-hosted n8n:** Settings → Community Nodes → Install → `n8n-nodes-duetrail`.

**Manually:**

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-duetrail
```

## Credentials

Create an API key in DueTrail under **Settings → API keys** (shown once), then add a *DueTrail API* credential in n8n. The base URL defaults to `https://duetrail.com/api/public/v1` and only needs changing for a self-hosted DueTrail.

## Example workflows

- **Stop chasing customers who have paid.** Stripe/bank trigger → *DueTrail: Record Payment*. Settling the invoice closes the case and resolves any outstanding promise.
- **Put overdue invoices into collections.** Schedule → your accounting system → *DueTrail: Create Invoice*. The case opens paused; nothing reaches a customer until live sending is on.
- **Route a broken promise to the team.** *DueTrail Trigger* (Promise Broken) → Slack/Teams/Linear.

## Design notes

- **The trigger keeps a cursor.** Unlike Zapier and Make, n8n does not deduplicate on the node's behalf, so the node persists the API's `next_since` in workflow static data. Losing it would replay the last 24 hours on every poll.
- **A manual test does not advance the cursor**, so trying the node in the editor cannot consume events the live workflow has not yet seen.
- **The first run sends no cursor**, letting the API's 24-hour default supply a usable sample without replaying history.
- **`external_id` on Create Invoice** is the idempotency key. n8n retries failed steps; without it, a retry creates a second invoice and the customer is chased twice.
- **Actions are declarative** (routing-based) rather than programmatic — every operation is a single REST call, which is the form n8n's reviewers prefer for API nodes.

## Development

```bash
npm install
npm run build          # tsc + copy the icon into dist
npm test               # structural tests, no n8n install needed
```

`npm test` runs `tsc --noEmit` first, then the structural tests. The type check is not optional: the structural tests read the TypeScript as text, so they pass happily on code that does not compile — which is exactly what happened before the first publish attempt. The structural tests check what a compiler cannot: that the trigger offers exactly the event types the API emits (no more, no fewer), that it reads the real response fields, that the cursor logic is present, that the package's `n8n.nodes` paths each have a source file, and that the icon is the brand mark.

## Publishing

**Do not `npm publish` from a laptop.** Since 2026-05-01 n8n only accepts community
nodes for verification if they were published from CI with a provenance statement.
A manual publish produces a package that installs fine but can never be verified,
and burns the version number.

Publish via this repo's **Publish n8n node** workflow (`.github/workflows/publish.yml`),
which type-checks, tests, verifies the package shape and publishes with
`--provenance`. It needs an npm automation token in the `NPM_TOKEN` repository
secret. Run it once with `dry_run` on to confirm the tarball, then again with it off.

Then submit for verification at the n8n Creator Portal so the node appears in the
in-app browser: <https://creators.n8n.io/nodes>

Verification requirements this package already meets: `n8n-nodes-` name prefix,
`n8n-community-node-package` keyword, the `n8n` attribute in package.json, MIT
licence, a README, and **no runtime dependencies** (keep it that way — adding one
disqualifies the node).

## License

MIT
