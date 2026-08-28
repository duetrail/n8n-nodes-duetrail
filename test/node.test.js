// Structural tests for the n8n node package.
//
// The TypeScript needs n8n-workflow to compile, which is not installed in this
// repo — so these read the source as text and check the invariants that would
// otherwise only surface after `npm install && npm run build` on someone
// else's machine, or worse, in a published package.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const trigger = read("nodes", "DueTrail", "DueTrailTrigger.node.ts");
const action = read("nodes", "DueTrail", "DueTrail.node.ts");
const credentials = read("credentials", "DueTrailApi.credentials.ts");
const pkg = JSON.parse(read("package.json"));

// domain.automationEventTypes — the only types GET /public/v1/events returns.
const AUTOMATION_EVENT_TYPES = [
  "promise_created",
  "promise_broken",
  "promise_kept",
  "payment_recorded",
  "case_closed_paid",
  "case_closed",
  "reminder_sent",
  "manual_reminder_sent",
  "portal_customer_reported_paid",
  "portal_customer_question",
];

test("the trigger offers every event type the API emits, and no invented ones", () => {
  const offered = [...trigger.matchAll(/value:\s*'([a-z_]+)'/g)].map((m) => m[1]).filter(Boolean);

  for (const type of AUTOMATION_EVENT_TYPES) {
    assert.ok(offered.includes(type), `trigger is missing event type "${type}"`);
  }
  for (const type of offered) {
    assert.ok(AUTOMATION_EVENT_TYPES.includes(type), `trigger offers unknown event type "${type}"`);
  }
});

test("the trigger reads the response fields the API actually returns", () => {
  // Verified against publicapi.EventsResponse: events / next_since / has_more,
  // and each event carries id, type, case_id, created_at, payload.
  assert.match(trigger, /response\.events/);
  assert.match(trigger, /response\.next_since/);
  assert.match(trigger, /e\.type === event/);
});

test("the trigger persists a cursor and does not advance it on manual runs", () => {
  // n8n, unlike Zapier and Make, does not deduplicate for the node — losing
  // the cursor would replay the last 24 hours on every poll.
  assert.match(trigger, /getWorkflowStaticData/);
  assert.match(trigger, /staticData\.since/);
  // A manual test must not consume events the live workflow has not seen.
  assert.match(trigger, /manualMode/);
  assert.match(trigger, /!manualMode && response\.next_since/);
});

test("credentials send a bearer token and test against /me", () => {
  assert.match(credentials, /Bearer \{\{\$credentials\.apiKey\}\}/);
  assert.match(credentials, /url:\s*'\/me'/);
  assert.match(credentials, /password:\s*true/);
  assert.match(credentials, /https:\/\/duetrail\.com\/api\/public\/v1/);
});

test("create invoice keeps the idempotency key", () => {
  // n8n retries failed steps; without external_id a retry creates a second
  // invoice and the customer is chased twice.
  assert.match(action, /property:\s*'external_id'/);
});

test("action routes match the public API's endpoints", () => {
  assert.match(action, /url:\s*'\/invoices'/);
  assert.match(action, /\/cases\/\{\{\$parameter\["case_id"\]\}\}\/payments/);
  assert.match(action, /\/cases\/\{\{\$parameter\["case_id"\]\}\}\/notes/);
});

test("the package declares itself to n8n correctly", () => {
  assert.ok(pkg.keywords.includes("n8n-community-node-package"), "required for n8n to list the package");
  assert.equal(pkg.n8n.n8nNodesApiVersion, 1);
  assert.equal(pkg.n8n.credentials.length, 1);
  assert.equal(pkg.n8n.nodes.length, 2);
  assert.equal(pkg.license, "MIT");

  // Every path n8n is pointed at must be a build output of a file that exists.
  for (const entry of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) {
    assert.ok(entry.startsWith("dist/"), `${entry} must point into dist`);
    const source = entry.replace(/^dist\//, "").replace(/\.js$/, ".ts");
    assert.ok(fs.existsSync(path.join(ROOT, source)), `${entry} has no source file at ${source}`);
  }
});

test("the node icon exists and is the brand mark", () => {
  const icon = read("nodes", "DueTrail", "duetrail.svg");
  assert.match(icon, /^<svg/);
  // The teal in the brand palette — a wrong-coloured icon is the kind of thing
  // nobody notices until it is in someone else's n8n editor.
  assert.match(icon, /#0d9488/i);
  assert.match(action, /icon:\s*'file:duetrail\.svg'/);
  assert.match(trigger, /icon:\s*'file:duetrail\.svg'/);
});
