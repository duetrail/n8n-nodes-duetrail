// Runtime tests: these execute the COMPILED node against a fake IPollFunctions.
//
// The structural tests read the TypeScript as text, so they cannot catch a
// wrong field path, a broken cursor, or a filter that never matches. These run
// the real poll() and assert on what it actually returns. Requires `npm run
// build` first — they import from dist/, deliberately, so they test the same
// artifact that gets published.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DIST = path.join(__dirname, "..", "dist", "nodes", "DueTrail", "DueTrailTrigger.node.js");

test("dist is built (run `npm run build` first)", () => {
  assert.ok(fs.existsSync(DIST), `missing ${DIST}`);
});

const { DueTrailTrigger } = require(DIST);

// Minimal stand-in for n8n's IPollFunctions — only what poll() actually touches.
function makeCtx({ event = "", staticData = {}, mode = "trigger", response }) {
  const requests = [];
  return {
    requests,
    staticData,
    ctx: {
      getCredentials: async () => ({ baseUrl: "https://example.test/api/public/v1", apiKey: "dt_live_x" }),
      getNodeParameter: (name) => (name === "event" ? event : undefined),
      getWorkflowStaticData: () => staticData,
      getMode: () => mode,
      getNode: () => ({ name: "DueTrail Trigger", type: "n8n-nodes-duetrail.dueTrailTrigger" }),
      helpers: {
        httpRequest: async (opts) => {
          requests.push(opts);
          if (response instanceof Error) throw response;
          return response;
        },
        returnJsonArray: (items) => items.map((json) => ({ json })),
      },
    },
  };
}

const EVT = (type, id) => ({ id, type, case_id: "c1", created_at: "2026-08-28T10:00:00Z" });

test("first poll sends no cursor, so the API's 24h default applies", async () => {
  const { ctx, requests } = makeCtx({ response: { events: [EVT("payment_recorded", "e1")], next_since: "T1" } });
  await DueTrailTrigger.prototype.poll.call(ctx);
  assert.equal(requests[0].qs.since, undefined);
  assert.equal(requests[0].qs.limit, 100);
  assert.equal(requests[0].url, "/events");
  assert.equal(requests[0].headers.Authorization, "Bearer dt_live_x");
});

test("a scheduled poll advances the cursor from next_since", async () => {
  const state = { since: "T0" };
  const { ctx, requests } = makeCtx({ staticData: state, response: { events: [EVT("promise_broken", "e1")], next_since: "T1" } });
  await DueTrailTrigger.prototype.poll.call(ctx);
  assert.equal(requests[0].qs.since, "T0", "should send the stored cursor");
  assert.equal(state.since, "T1", "should persist the returned cursor");
});

test("a manual run neither sends nor advances the cursor", async () => {
  const state = { since: "T0" };
  const { ctx, requests } = makeCtx({
    staticData: state,
    mode: "manual",
    response: { events: [EVT("case_closed_paid", "e1")], next_since: "T99" },
  });
  await DueTrailTrigger.prototype.poll.call(ctx);
  assert.equal(requests[0].qs.since, undefined, "manual must not send the live cursor");
  assert.equal(state.since, "T0", "manual must not consume events the live workflow has not seen");
});

test("filters to the selected event type", async () => {
  const { ctx } = makeCtx({
    event: "promise_broken",
    response: { events: [EVT("payment_recorded", "e1"), EVT("promise_broken", "e2")], next_since: "T1" },
  });
  const out = await DueTrailTrigger.prototype.poll.call(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].length, 1);
  assert.equal(out[0][0].json.id, "e2");
});

test("returns null when nothing matches, so the workflow does not fire", async () => {
  const { ctx } = makeCtx({
    event: "promise_broken",
    response: { events: [EVT("payment_recorded", "e1")], next_since: "T1" },
  });
  assert.equal(await DueTrailTrigger.prototype.poll.call(ctx), null);
});

test("an empty page still advances the cursor and fires nothing", async () => {
  const state = { since: "T0" };
  const { ctx } = makeCtx({ staticData: state, response: { events: [], next_since: "T1" } });
  assert.equal(await DueTrailTrigger.prototype.poll.call(ctx), null);
  assert.equal(state.since, "T1");
});

test("a missing events array is tolerated, not a crash", async () => {
  const { ctx } = makeCtx({ response: {} });
  assert.equal(await DueTrailTrigger.prototype.poll.call(ctx), null);
});

test("an HTTP failure surfaces as a NodeApiError, not a raw throw", async () => {
  const { ctx } = makeCtx({ response: Object.assign(new Error("401 unauthorized"), { statusCode: 401 }) });
  await assert.rejects(() => DueTrailTrigger.prototype.poll.call(ctx), (err) => err.constructor.name === "NodeApiError");
});
