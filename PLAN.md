# Bright Data MCP Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork Bright Data's official MCP server and add the Scraper Studio
lifecycle it lacks — create, run, detect breakage, self-heal, verify, escalate —
plus the remaining CLI-only features, a dashboard, and an unattended CI cron.

**Architecture:** The fork is the repo root. Their 69 tools stay untouched. Our
code lives in new directories (`scraper/`, `account/`, `web/`) with surgical
edits to `server.js` and `tool_groups.js` to register tools. All Bright Data
access is direct REST via `axios` — no `bdata` CLI dependency at runtime. The
only stateful component is `registry.json`, which maps domain to collector and
holds health baselines and heal history.

**Tech Stack:** Node 20+ · ESM · `fastmcp` · `zod` v3 · `axios` · `node:test` ·
Express (dashboard) · GitHub Actions (cron)

**Spec:** [PROJECT_SPEC.md](PROJECT_SPEC.md) · Conventions: [CLAUDE.md](CLAUDE.md)

---

## Global Constraints

- Node `>=20.0.0`. ESM only (`"type": "module"`).
- `zod` **v3** (`^3.24.2`). Not v4.
- `fastmcp` `addTool({name, description, annotations, parameters, execute})`.
- House style: 4-space indent, `snake_case`, leading-`+` string wrapping.
- Auth: `process.env.API_TOKEN`, `Authorization: Bearer ${API_TOKEN}`.
- API base: `https://api.brightdata.com`.
- Every new tool must be registered in `tool_groups.js` or it silently will not
  load.
- AI jobs (create, heal) must be serialized. Retry 429 four times, 30s to 240s
  exponential backoff.
- Escalation is capped at **one** regeneration. Each regeneration deletes the
  collector it abandoned, and deletion is irreversible.
- `reference/` is read-only and gitignored.
- Only public web data. No login-gated, paywalled, or personal data.
- Never log, commit, or return `API_TOKEN`.
- Tests run with `node --test` (already the repo's `npm test`).

---

## File Structure

| File | Owner | Responsibility |
|---|---|---|
| `scraper/api.js` | ours | REST calls to `/dca/*`, polling, 429 retry |
| `scraper/requests.js` | ours | Pure payload builders + status classification |
| `scraper/registry.js` | ours | `registry.json` read/write, heal history |
| `scraper/health.js` | ours | Schema-drift and null-ratio detection |
| `scraper/ensure.js` | ours | The reuse/create/run/heal/verify/escalate loop |
| `scraper/tools.js` | ours | The 7 lifecycle MCP tools |
| `account/tools.js` | ours | zones, budget, scrape variants, discover+content |
| `web/server.js` | ours | Express API + Anthropic tool-use chat loop |
| `web/frontend/` | ours | Chat panel, registry table, heal log |
| `.github/workflows/scrape.yml` | ours | The unattended cron |
| `test/scraper/*.test.js` | ours | Unit tests |
| `server.js` | theirs | +3 import lines, +3 registration calls |
| `tool_groups.js` | theirs | +1 group, tool names added to base list |
| `browser_tools.js` | theirs | +7 missing browser verbs |
| `assets/Tools.md` | theirs | +13 tool rows |
| `README.md` | theirs | Rewritten header, attribution, AI disclosure |

`requests.js` is split from `api.js` deliberately: payload building and status
classification are pure and testable without mocking HTTP.

---

## Task 0: Fork setup

**Files:**
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Back up the irreplaceable files first**

The repo root is `d:\Projects\BrightData`, which already holds `CLAUDE.md`,
`PLAN.md`, `PROJECT_SPEC.md`, and `reference/`. These are the only artifacts
here that cannot be re-downloaded. Copy them out before touching git:

```bash
cd /d/Projects/BrightData
mkdir -p ../BrightData-docs-backup
cp CLAUDE.md PLAN.md PROJECT_SPEC.md ../BrightData-docs-backup/
```

- [ ] **Step 2: Bring upstream's files in around them**

`checkout` writes only the paths it is given and leaves everything else alone.
Do **not** use `git reset --hard` here — it rewrites the working tree against a
freshly-initialised index and a stale or partial index will take the docs with
it.

```bash
git init
git remote add upstream https://github.com/brightdata/brightdata-mcp.git
git fetch --depth 1 upstream main
git checkout upstream/main -- .
```

Verify all of these exist before continuing:

```bash
ls server.js tool_groups.js CLAUDE.md PLAN.md PROJECT_SPEC.md reference/
```

If anything is missing, restore from `../BrightData-docs-backup/`.

- [ ] **Step 3: Add a fork remote**

Create an empty repo `brightdata-mcp-studio` on GitHub, then:

```bash
git remote add origin https://github.com/<user>/brightdata-mcp-studio.git
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
reference/
registry.json
.env
web/frontend/dist/
```

`registry.json` is gitignored locally but **committed by CI** (Task 3) — the
workflow force-adds it. This keeps local experimentation out of git while the
cron's history stays public.

- [ ] **Step 5: Write `.env.example`**

```
# Bright Data API key. From https://brightdata.com/cp/setting
# or %APPDATA%\brightdata-cli\credentials.json if you ran `bdata login`.
API_TOKEN=

# Dashboard chat agent (optional, only needed for web/)
ANTHROPIC_API_KEY=
```

- [ ] **Step 6: Verify the server still starts**

```bash
npm install
API_TOKEN=<your key> node server.js
```
Expected: zone-check lines on stderr, then it blocks on stdio. Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add .gitignore .env.example CLAUDE.md PLAN.md PROJECT_SPEC.md
git commit -m "chore: fork setup, project docs, gitignore"
git push -u origin main
```

---

## Task 1: Pure request builders and status classification

**Files:**
- Create: `scraper/requests.js`
- Test: `test/scraper/requests.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `build_collector_request({name, deliver_webhook}) -> object`
  - `build_ai_request(url, description) -> {description, urls}`
  - `build_heal_request(prompt) -> {description}`
  - `build_resume_request(approve, auto_save) -> object`
  - `classify_status(progress) -> 'done'|'awaiting'|'failed'|'running'`
  - Constants: `DONE`, `AWAITING_STATUS`, `TERMINAL_FAIL_STATUSES`

- [ ] **Step 1: Write the failing test**

```js
// test/scraper/requests.test.js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    build_collector_request, build_ai_request, build_resume_request,
    classify_status,
} from '../../scraper/requests.js';

test('build_collector_request uses a stub webhook by default', ()=>{
    const req = build_collector_request({name: 'x'});
    assert.equal(req.name, 'x');
    assert.equal(req.deliver.type, 'webhook');
    assert.equal(req.deliver.endpoint, 'https://example.com/webhook');
    assert.deepEqual(req.deliver.filename,
        {template: 'data', extension: 'json'});
});

test('build_ai_request wraps the url in an array', ()=>{
    assert.deepEqual(build_ai_request('https://a.com', 'title and price'),
        {description: 'title and price', urls: ['https://a.com']});
});

test('build_resume_request omits auto_save on reject', ()=>{
    assert.deepEqual(build_resume_request(true, true),
        {message: true, auto_save: true});
    assert.deepEqual(build_resume_request(false, true), {message: false});
});

test('classify_status maps the API vocabulary', ()=>{
    assert.equal(classify_status({status: 'done'}), 'done');
    assert.equal(classify_status({status: 'pending_answer'}), 'awaiting');
    assert.equal(classify_status({status: 'failed'}), 'failed');
    assert.equal(classify_status({status: 'cancelled'}), 'failed');
    assert.equal(classify_status({status: 'collecting'}), 'running');
    assert.equal(classify_status({}), 'running');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/scraper/requests.test.js`
Expected: FAIL — cannot find module `../../scraper/requests.js`

- [ ] **Step 3: Implement**

```js
// scraper/requests.js
'use strict';

export const DONE = 'done';
export const AWAITING_STATUS = 'pending_answer';
export const TERMINAL_FAIL_STATUSES = ['failed', 'error', 'cancelled'];

const STUB_WEBHOOK = 'https://example.com/webhook';

export const build_collector_request = ({name, deliver_webhook})=>({
    name,
    deliver: {
        type: 'webhook',
        endpoint: deliver_webhook || STUB_WEBHOOK,
        filename: {template: 'data', extension: 'json'},
    },
});

export const build_ai_request = (url, description)=>({
    description,
    urls: [url],
});

export const build_heal_request = prompt=>({description: prompt});

// auto_save only takes effect on approval; the API ignores it on reject,
// so we omit it there to keep the body minimal.
export const build_resume_request = (approve, auto_save)=>
    approve && auto_save ? {message: true, auto_save: true}
        : {message: approve};

export const classify_status = progress=>{
    const status = progress?.status;
    if (status == DONE)
        return 'done';
    if (status == AWAITING_STATUS)
        return 'awaiting';
    if (TERMINAL_FAIL_STATUSES.includes(status))
        return 'failed';
    return 'running';
};
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/scraper/requests.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add scraper/requests.js test/scraper/requests.test.js
git commit -m "feat: scraper request builders and status classification"
```

---

## Task 2: REST client with polling and 429 retry

**Files:**
- Create: `scraper/api.js`
- Test: `test/scraper/api.test.js`

**Interfaces:**
- Consumes: everything from `scraper/requests.js`
- Produces:
  - `create_collector(token, {name, deliver_webhook}) -> {collector_id}`
  - `start_ai_build(token, collector_id, {url, description}) -> void`
  - `get_build_progress(token, collector_id) -> progress`
  - `start_heal(token, collector_id, prompt) -> void`
  - `get_heal_progress(token, collector_id) -> progress`
  - `resume_job(token, collector_id, {approve, auto_save}) -> void`
  - `run_collector(token, collector_id, url) -> array`
  - `poll_until({fetch_once, classify, timeout_seconds, on_tick}) -> {outcome, result}`
  - `with_ai_retry(fn) -> result`

- [ ] **Step 1: Write the failing test**

Only the two pieces with real logic are tested; the thin HTTP wrappers are
covered by the integration check in Step 6.

```js
// test/scraper/api.test.js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    poll_until, with_ai_retry, classify_raw, is_realtime_limit,
} from '../../scraper/api.js';

test('poll_until stops on a terminal outcome', async ()=>{
    let calls = 0;
    const res = await poll_until({
        fetch_once: async ()=>({status: ++calls < 3 ? 'collecting' : 'done'}),
        classify: p=>p.status=='done' ? 'done' : 'running',
        timeout_seconds: 10,
        interval_ms: 1,
    });
    assert.equal(res.outcome, 'done');
    assert.equal(calls, 3);
});

test('poll_until throws on timeout', async ()=>{
    await assert.rejects(()=>poll_until({
        fetch_once: async ()=>({status: 'collecting'}),
        classify: ()=>'running',
        timeout_seconds: 0,
        interval_ms: 1,
    }), /timed out/i);
});

test('with_ai_retry retries the concurrent-job cap then succeeds', async ()=>{
    let attempts = 0;
    const out = await with_ai_retry(async ()=>{
        if (++attempts < 3)
            throw new Error('cannot run more than 2 jobs in parallel');
        return 'ok';
    }, {max_retries: 4, base_ms: 1, max_ms: 2});
    assert.equal(out, 'ok');
    assert.equal(attempts, 3);
});

test('with_ai_retry rethrows errors that are not the cap', async ()=>{
    await assert.rejects(()=>with_ai_retry(async ()=>{
        throw new Error('401 unauthorized');
    }, {max_retries: 4, base_ms: 1}), /unauthorized/);
});

test('classify_raw treats 202, empty and building as not ready', ()=>{
    assert.equal(classify_raw({status: 202, body: ''}), 'running');
    assert.equal(classify_raw({status: 200, body: '   '}), 'running');
    assert.equal(classify_raw({status: 200, body: '{"status":"building"}'}),
        'running');
    assert.equal(classify_raw({status: 500, body: 'boom'}), 'running');
    assert.equal(classify_raw({status: 200, body: '[{"title":"A"}]'}), 'done');
});

test('is_realtime_limit detects the page-limit sentinel', ()=>{
    assert.equal(is_realtime_limit(
        [{error: 'Realtime job limit exceeded for this page'}]), true);
    assert.equal(is_realtime_limit([{title: 'A'}]), false);
    assert.equal(is_realtime_limit([]), false);
    // a mixed array is real data with one bad row, not a limit error
    assert.equal(is_realtime_limit(
        [{error: 'realtime job limit'}, {title: 'A'}]), false);
});
```

`classify_raw` and `is_realtime_limit` must be exported for these tests. Add
them to the import at the top of the test file.

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/scraper/api.test.js`
Expected: FAIL — cannot find module `../../scraper/api.js`

- [ ] **Step 3: Implement**

```js
// scraper/api.js
'use strict';
import axios from 'axios';
import {
    build_collector_request, build_ai_request, build_heal_request,
    build_resume_request,
} from './requests.js';

const BASE_URL = 'https://api.brightdata.com';
const POLL_INTERVAL_MS = 5_000;
const AI_RETRY_BASE_MS = 30_000;
const AI_RETRY_MAX_MS = 240_000;
const AI_RETRY_DEFAULT = 4;
const CONCURRENCY_CAP = /cannot run more than \d+ jobs in parallel/i;

const sleep = ms=>new Promise(r=>setTimeout(r, ms));

const request = async (token, method, path, data)=>{
    try {
        const res = await axios({
            url: `${BASE_URL}${path}`,
            method,
            data,
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
        });
        return res.data;
    } catch(e){
        const detail = e.response?.data?.error || e.response?.data
            || e.message;
        throw new Error(`${method} ${path} failed: `
            +`${typeof detail=='string' ? detail : JSON.stringify(detail)}`);
    }
};

// Bright Data caps concurrent AI-Flow jobs. Wait it out rather than failing,
// growing the delay each attempt.
export const with_ai_retry = async (fn, opts = {})=>{
    const max_retries = opts.max_retries ?? AI_RETRY_DEFAULT;
    const base_ms = opts.base_ms ?? AI_RETRY_BASE_MS;
    const max_ms = opts.max_ms ?? AI_RETRY_MAX_MS;
    for (let attempt = 0;; attempt++)
    {
        try {
            return await fn();
        } catch(e){
            if (attempt >= max_retries || !CONCURRENCY_CAP.test(e.message))
                throw e;
            await sleep(Math.min(base_ms*2**attempt, max_ms));
        }
    }
};

export const poll_until = async ({fetch_once, classify, timeout_seconds,
    interval_ms = POLL_INTERVAL_MS, on_tick})=>
{
    const deadline = Date.now()+timeout_seconds*1000;
    for (let attempt = 1;; attempt++)
    {
        const result = await fetch_once();
        const outcome = classify(result);
        if (outcome != 'running')
            return {outcome, result};
        if (Date.now() >= deadline)
            throw new Error(`Polling timed out after ${timeout_seconds}s`);
        on_tick?.({attempt, result});
        await sleep(interval_ms);
    }
};

export const create_collector = async (token, opts)=>{
    const res = await request(token, 'POST', '/dca/collector',
        build_collector_request(opts));
    const collector_id = res?.collector_id || res?.collector || res?.id;
    if (!collector_id)
        throw new Error('No collector_id returned from /dca/collector');
    return {collector_id, name: opts.name};
};

export const start_ai_build = (token, collector_id, {url, description})=>
    with_ai_retry(()=>request(token, 'POST',
        `/dca/collectors/${collector_id}/automate_template`,
        build_ai_request(url, description)));

export const get_build_progress = (token, collector_id)=>
    request(token, 'GET',
        `/dca/collectors/${collector_id}/automate_template/progress`);

export const start_heal = (token, collector_id, prompt)=>
    with_ai_retry(()=>request(token, 'POST',
        `/dca/collectors/${collector_id}/refactor_template`,
        build_heal_request(prompt)));

export const get_heal_progress = (token, collector_id)=>
    request(token, 'GET',
        `/dca/collectors/${collector_id}/refactor_template/progress`);

export const resume_job = (token, collector_id, {approve, auto_save})=>
    request(token, 'POST',
        `/dca/collectors/${collector_id}/resume_automation_job`,
        build_resume_request(approve, auto_save));

// A result body of [{error: "...realtime job limit..."}] means the page was
// too large for the realtime path. It is not a failure — rerun via batch.
const REALTIME_LIMIT_MARKER = 'realtime job limit';

const is_realtime_limit = data=>Array.isArray(data) && data.length
    && data.every(item=>typeof item?.error == 'string'
        && item.error.toLowerCase().includes(REALTIME_LIMIT_MARKER));

// 202, any non-2xx, an empty body, or {status: 'building'} all mean "not
// ready". Anything else is the payload.
const classify_raw = ({status, body})=>{
    if (status == 202 || status < 200 || status >= 300)
        return 'running';
    const trimmed = (body || '').trim();
    if (!trimmed)
        return 'running';
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed == 'object' && !Array.isArray(parsed)
            && parsed.status == 'building')
        {
            return 'running';
        }
    } catch(e){}
    return 'done';
};

const parse_body = body=>{
    const trimmed = (body || '').trim();
    try {
        return JSON.parse(trimmed);
    } catch(e){
        return trimmed;
    }
};

// Raw fetch: polling needs the status code, which axios throws away on 202
// vs 200 boundaries and turns into an exception on 4xx.
const fetch_raw = async (token, path)=>{
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {authorization: `Bearer ${token}`},
    });
    return {status: res.status, body: await res.text()};
};

const run_batch = async (token, collector_id, urls, timeout_seconds)=>{
    const trigger = await request(token, 'POST',
        `/dca/trigger?collector=${encodeURIComponent(collector_id)}`,
        urls.map(url=>({url})));
    const collection_id = trigger?.collection_id;
    if (!collection_id)
        throw new Error('No collection_id returned from /dca/trigger');
    const {result} = await poll_until({
        timeout_seconds,
        interval_ms: BATCH_POLL_INTERVAL_MS,
        fetch_once: ()=>fetch_raw(token,
            `/dca/dataset?id=${encodeURIComponent(collection_id)}`),
        classify: classify_raw,
    });
    return parse_body(result.body);
};

export const run_collector = async (token, collector_id, url,
    {timeout_seconds = 600, batch_timeout_seconds = 3600} = {})=>
{
    const trigger = await request(token, 'POST',
        `/dca/trigger_immediate?collector=${encodeURIComponent(collector_id)}`,
        {url});
    const response_id = trigger?.response_id;
    if (!response_id)
        throw new Error('No response_id returned from /dca/trigger_immediate');
    const {result} = await poll_until({
        timeout_seconds,
        fetch_once: ()=>fetch_raw(token,
            `/dca/get_result?response_id=${encodeURIComponent(response_id)}`),
        classify: classify_raw,
    });
    const data = parse_body(result.body);
    if (is_realtime_limit(data))
        return run_batch(token, collector_id, [url], batch_timeout_seconds);
    return data;
};
```

Add `const BATCH_POLL_INTERVAL_MS = 10_000;` alongside the other constants.

- [ ] **Step 4: Run the tests**

Run: `node --test test/scraper/api.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add scraper/api.js test/scraper/api.test.js
git commit -m "feat: bright data DCA rest client with polling and retry"
```

- [ ] **Step 6: Verify against the live API**

The envelopes above are ported from
`reference/brightdata-cli/src/commands/scraper.ts`, but confirm both paths
against real responses before anything depends on them. Use the collector
created during viability testing:

```bash
node -e "import('./scraper/api.js').then(async m=>{
  const d = await m.run_collector(process.env.API_TOKEN,
    'c_mszlsh29flg1gvzp8', 'https://news.ycombinator.com');
  console.log(Array.isArray(d), d?.length, d?.[0]);
})"
```

Expected: `true`, a row count, and one record with `title`, `points`, `author`.

This collector is known to exceed the realtime page limit, so a correct run
**must** traverse the batch fallback. Add a temporary `console.error` inside
`run_batch` to confirm it is reached. If the run instead polls
`/dca/get_result` until it times out, `is_realtime_limit` is not matching the
error text — log the raw body and compare against the `REALTIME_LIMIT_MARKER`
check in the CLI source. Remove the temporary logging before committing.
## Task 3: CI cron against a stub

Ship this **now**, before the logic exists. The unattended run history is the
project's strongest evidence and it needs elapsed days — every hour of delay is
an hour of history lost.

**Files:**
- Create: `.github/workflows/scrape.yml`
- Create: `scripts/cron.js`
- Create: `registry.json` (seeded with one entry)

- [ ] **Step 1: Seed the registry**

Use the collector already created during viability testing so the cron has real
work from run one.

```json
{
    "news.ycombinator.com": {
        "collector_id": "c_mszlsh29flg1gvzp8",
        "name": "cli-scraper-1787114432",
        "source_url": "https://news.ycombinator.com",
        "description": "top stories: title, points, author",
        "created_at": "2026-08-19T00:00:00Z",
        "status": "active",
        "schema_baseline": null,
        "last_sample": null,
        "heal_history": []
    }
}
```

- [ ] **Step 2: Write the cron script**

`ensure` does not exist yet, so run each collector directly and record the
result. Task 6 swaps the body for a real `ensure()` call.

```js
// scripts/cron.js
'use strict';
import fs from 'node:fs/promises';
import {run_collector} from '../scraper/api.js';

const token = process.env.API_TOKEN;
if (!token)
    throw new Error('API_TOKEN is required');

const registry = JSON.parse(await fs.readFile('registry.json', 'utf8'));
let failures = 0;

for (const [domain, entry] of Object.entries(registry))
{
    if (entry.status != 'active')
        continue;
    try {
        const data = await run_collector(token, entry.collector_id,
            entry.source_url);
        entry.last_run_at = new Date().toISOString();
        entry.last_row_count = data.length;
        entry.last_sample = data.slice(0, 3);
        console.log(`${domain}: ok, ${data.length} rows`);
    } catch(e){
        failures++;
        entry.last_error = e.message;
        console.error(`${domain}: FAILED — ${e.message}`);
    }
}

await fs.writeFile('registry.json', JSON.stringify(registry, null, 4)+'\n');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 3: Write the workflow**

```yaml
name: scheduled-scrape

on:
    schedule:
        - cron: '0 */6 * * *'
    workflow_dispatch:

permissions:
    contents: write

concurrency:
    group: scheduled-scrape
    cancel-in-progress: false

jobs:
    scrape:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
            - run: npm ci
            - name: Run scrapers
              env:
                  API_TOKEN: ${{ secrets.BRIGHTDATA_API_KEY }}
              run: node scripts/cron.js
            - name: Commit registry
              if: always()
              run: |
                  git config user.name  "github-actions[bot]"
                  git config user.email "github-actions[bot]@users.noreply.github.com"
                  git add -f registry.json
                  git diff --staged --quiet || git commit -m "chore: registry update [skip ci]"
                  git push
```

`permissions: contents: write` is required — the default `GITHUB_TOKEN` is
read-only and the push will fail without it. `git add -f` is required because
`registry.json` is gitignored.

- [ ] **Step 4: Add the secret and trigger a run**

Add `BRIGHTDATA_API_KEY` under Settings → Secrets → Actions. Then push and run
the workflow manually from the Actions tab.

Expected: green check, a commit titled `chore: registry update`, and
`registry.json` in the repo containing `last_run_at` and `last_row_count`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/scrape.yml scripts/cron.js registry.json
git commit -m "feat: scheduled scrape workflow with registry commit"
git push
```

---

## Task 4: Registry persistence

**Files:**
- Create: `scraper/registry.js`
- Test: `test/scraper/registry.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `domain_of(url) -> string`
  - `load_registry(path?) -> object`
  - `save_registry(registry, path?) -> void`
  - `get_entry(registry, url) -> entry|undefined`
  - `put_entry(registry, url, entry) -> registry` (returns a new object)
  - `record_heal(registry, url, event) -> registry` (returns a new object)
  - `abandon(registry, url) -> registry` (returns a new object)

Entry shape:

```js
{
    collector_id: 'c_x',
    name: 'studio-example-com-1787114432',
    source_url: 'https://example.com/shop',
    description: 'name, price, in stock',
    created_at: '2026-08-19T10:00:00Z',
    status: 'active',              // or 'abandoned'
    schema_baseline: ['name', 'price', 'in_stock'],
    last_sample: [/* up to 3 records */],
    last_run_at: '2026-08-19T10:04:00Z',
    last_row_count: 35,
    heal_history: [/* events */],
}
```

Heal event shape:

```js
{
    timestamp: '2026-08-20T03:00:00Z',
    prompt: 'price returns null; selector likely moved',
    status: 'resolved',            // or 'failed'
    auto_triggered: true,
    escalated: false,
    replaced_by: null,             // collector_id when escalated
}
```

- [ ] **Step 1: Write the failing test**

```js
// test/scraper/registry.test.js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    domain_of, get_entry, put_entry, record_heal, abandon,
} from '../../scraper/registry.js';

test('domain_of strips scheme, www and path', ()=>{
    assert.equal(domain_of('https://www.Example.com/shop?a=1'), 'example.com');
    assert.equal(domain_of('http://news.ycombinator.com'),
        'news.ycombinator.com');
});

test('put_entry does not mutate the input registry', ()=>{
    const before = {};
    const after = put_entry(before, 'https://a.com', {collector_id: 'c_1'});
    assert.deepEqual(before, {});
    assert.equal(get_entry(after, 'https://a.com/x').collector_id, 'c_1');
});

test('record_heal appends without mutating', ()=>{
    const r0 = put_entry({}, 'https://a.com',
        {collector_id: 'c_1', heal_history: []});
    const r1 = record_heal(r0, 'https://a.com', {status: 'resolved'});
    assert.equal(r0['a.com'].heal_history.length, 0);
    assert.equal(r1['a.com'].heal_history.length, 1);
    assert.equal(r1['a.com'].heal_history[0].status, 'resolved');
});

test('abandon marks the entry without deleting it', ()=>{
    const r0 = put_entry({}, 'https://a.com', {collector_id: 'c_1'});
    const r1 = abandon(r0, 'https://a.com');
    assert.equal(r1['a.com'].status, 'abandoned');
    assert.equal(r1['a.com'].collector_id, 'c_1');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/scraper/registry.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```js
// scraper/registry.js
'use strict';
import fs from 'node:fs';

const DEFAULT_PATH = process.env.REGISTRY_PATH || 'registry.json';

export const domain_of = url=>
    new URL(url).hostname.toLowerCase().replace(/^www\./, '');

export const load_registry = (path = DEFAULT_PATH)=>{
    if (!fs.existsSync(path))
        return {};
    return JSON.parse(fs.readFileSync(path, 'utf8'));
};

export const save_registry = (registry, path = DEFAULT_PATH)=>
    fs.writeFileSync(path, JSON.stringify(registry, null, 4)+'\n');

export const get_entry = (registry, url)=>registry[domain_of(url)];

export const put_entry = (registry, url, entry)=>({
    ...registry,
    [domain_of(url)]: entry,
});

// Entries are replaced wholesale rather than mutated so callers can hold an
// older snapshot safely.
const update_entry = (registry, url, change)=>{
    const domain = domain_of(url);
    const entry = registry[domain];
    if (!entry)
        throw new Error(`No registry entry for ${domain}`);
    return {...registry, [domain]: {...entry, ...change}};
};

export const record_heal = (registry, url, event)=>{
    const entry = get_entry(registry, url);
    return update_entry(registry, url, {
        heal_history: [...(entry?.heal_history || []), {
            timestamp: new Date().toISOString(),
            auto_triggered: true,
            escalated: false,
            replaced_by: null,
            ...event,
        }],
    });
};

export const abandon = (registry, url)=>
    update_entry(registry, url, {status: 'abandoned'});
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/scraper/registry.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add scraper/registry.js test/scraper/registry.test.js
git commit -m "feat: registry persistence with immutable updates"
```

---

## Task 5: Health detection

Two checks only, both of which produce signal from a **single** run: schema
drift and null-field ratio. Row-count anomaly detection is deliberately excluded
— it needs a baseline of many runs to be meaningful and fires spuriously before
then.

**Files:**
- Create: `scraper/health.js`
- Test: `test/scraper/health.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `schema_of(records) -> string[]` (sorted field names, `input` excluded)
  - `check_health(records, baseline) -> {healthy, reasons, schema}`

- [ ] **Step 1: Write the failing test**

```js
// test/scraper/health.test.js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schema_of, check_health} from '../../scraper/health.js';

const good = [
    {title: 'A', price: '$1', input: {url: 'x'}},
    {title: 'B', price: '$2', input: {url: 'x'}},
];

test('schema_of sorts fields and drops the echoed input key', ()=>{
    assert.deepEqual(schema_of(good), ['price', 'title']);
});

test('healthy data with a matching baseline passes', ()=>{
    const res = check_health(good, ['price', 'title']);
    assert.equal(res.healthy, true);
    assert.deepEqual(res.reasons, []);
});

test('empty result is unhealthy', ()=>{
    const res = check_health([], ['price', 'title']);
    assert.equal(res.healthy, false);
    assert.match(res.reasons[0], /no records/i);
});

test('a fully null field is reported by name', ()=>{
    const res = check_health(
        [{title: 'A', price: null}, {title: 'B', price: ''}],
        ['price', 'title']);
    assert.equal(res.healthy, false);
    assert.match(res.reasons.join(' '), /price.*100%/i);
});

test('a missing field is reported as schema drift', ()=>{
    const res = check_health([{title: 'A'}], ['price', 'title']);
    assert.equal(res.healthy, false);
    assert.match(res.reasons.join(' '), /missing.*price/i);
});

test('no baseline means the first run establishes one', ()=>{
    const res = check_health(good, null);
    assert.equal(res.healthy, true);
    assert.deepEqual(res.schema, ['price', 'title']);
});

test('fieldless records are unhealthy even with no baseline', ()=>{
    // what a bad rebuild produces: rows exist, but nothing was extracted
    const res = check_health([{}, {}, {}], null);
    assert.equal(res.healthy, false);
    assert.match(res.reasons.join(' '), /no extracted fields/i);
});

test('records that are all null in every field are unhealthy', ()=>{
    const res = check_health(
        [{title: null, price: null}, {title: null, price: null}], null);
    assert.equal(res.healthy, false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/scraper/health.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```js
// scraper/health.js
'use strict';

// Every record echoes the trigger input back. It is constant, never drifts,
// and would dilute the null ratio, so it is not part of the schema.
const IGNORED_FIELDS = ['input'];

const NULL_RATIO_THRESHOLD = 0.9;

const is_empty = value=>value==null || value==='' ||
    Array.isArray(value) && !value.length;

export const schema_of = records=>{
    const fields = new Set();
    for (const record of records || [])
    {
        for (const key of Object.keys(record || {}))
        {
            if (!IGNORED_FIELDS.includes(key))
                fields.add(key);
        }
    }
    return [...fields].sort();
};

export const check_health = (records, baseline)=>{
    const schema = schema_of(records);
    if (!Array.isArray(records) || !records.length)
        return {healthy: false, reasons: ['Run returned no records'], schema};

    // With no baseline the null-ratio loop iterates `schema`, and a field that
    // is empty in every record never enters `schema` at all — so records of
    // [{}, {}, {}] would otherwise pass. This is exactly what a bad rebuild
    // produces, so guard it before anything else.
    if (!schema.length)
    {
        return {healthy: false, schema,
            reasons: ['Records contain no extracted fields']};
    }

    const reasons = [];

    if (baseline?.length)
    {
        const missing = baseline.filter(f=>!schema.includes(f));
        if (missing.length)
            reasons.push(`Schema drift: missing ${missing.join(', ')}`);
    }

    for (const field of baseline?.length ? baseline : schema)
    {
        const empty = records.filter(r=>is_empty(r?.[field])).length;
        const ratio = empty/records.length;
        if (ratio >= NULL_RATIO_THRESHOLD)
        {
            reasons.push(`Field "${field}" is empty in `
                +`${Math.round(ratio*100)}% of records`);
        }
    }

    return {healthy: !reasons.length, reasons, schema};
};
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/scraper/health.test.js`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add scraper/health.js test/scraper/health.test.js
git commit -m "feat: schema drift and null ratio health detection"
```

---

## Task 6: The ensure loop

**Files:**
- Create: `scraper/ensure.js`
- Test: `test/scraper/ensure.test.js`
- Modify: `scripts/cron.js` (replace the stub body)

**Interfaces:**
- Consumes: `scraper/api.js`, `scraper/registry.js`, `scraper/health.js`
- Produces:
  - `create_and_wait(token, url, description, {on_progress}) -> entry`
  - `heal_and_verify(token, entry, reasons) -> {healed, records, health}`
  - `ensure(token, url, description, {auto_heal, deps}) -> result`

`ensure` result shape:

```js
{
    domain: 'example.com',
    collector_id: 'c_x',
    created: false,
    healed: true,
    escalated: false,
    health: {healthy: true, reasons: [], schema: [...]},
    records: [...],
    trace: ['registry hit', 'run: 35 rows', 'health FAILED: ...', ...],
}
```

The `deps` option exists so tests can inject fakes for the API layer. Default
it to the real module.

- [ ] **Step 1: Write the failing test**

```js
// test/scraper/ensure.test.js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensure} from '../../scraper/ensure.js';

const entry = url=>({
    collector_id: 'c_1', source_url: url, description: 'title, price',
    status: 'active', schema_baseline: ['price', 'title'], heal_history: [],
});
const good = [{title: 'A', price: '$1'}];
const broken = [{title: 'A', price: null}];

const make_deps = over=>({
    load: ()=>({'a.com': entry('https://a.com')}),
    save: ()=>{},
    run: async ()=>good,
    create: async ()=>({collector_id: 'c_new', name: 'n'}),
    heal: async ()=>{},
    ...over,
});

test('registry hit with healthy data does not heal', async ()=>{
    const res = await ensure('t', 'https://a.com', 'title, price',
        {deps: make_deps()});
    assert.equal(res.created, false);
    assert.equal(res.healed, false);
    assert.equal(res.health.healthy, true);
});

test('unhealthy data triggers a heal, then verifies', async ()=>{
    let runs = 0;
    const res = await ensure('t', 'https://a.com', 'title, price',
        {deps: make_deps({run: async ()=>++runs==1 ? broken : good})});
    assert.equal(res.healed, true);
    assert.equal(res.escalated, false);
    assert.equal(res.health.healthy, true);
    assert.equal(runs, 2);
});

test('still broken after healing escalates exactly once', async ()=>{
    let creates = 0;
    const res = await ensure('t', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            create: async ()=>{ creates++; return {collector_id: 'c_new'}; },
        }),
    });
    assert.equal(res.escalated, true);
    assert.equal(creates, 1);
    assert.equal(res.health.healthy, false);
});

test('registry miss creates a scraper', async ()=>{
    const res = await ensure('t', 'https://b.com', 'title, price',
        {deps: make_deps({load: ()=>({})})});
    assert.equal(res.created, true);
    assert.equal(res.collector_id, 'c_new');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/scraper/ensure.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```js
// scraper/ensure.js
'use strict';
import * as api from './api.js';
import {
    load_registry, save_registry, get_entry, put_entry, record_heal, abandon,
    domain_of,
} from './registry.js';
import {check_health} from './health.js';
import {classify_status} from './requests.js';

const BUILD_TIMEOUT_SECONDS = 900;

const default_deps = {
    load: load_registry,
    save: save_registry,
    run: api.run_collector,
    create: create_and_wait,
    heal: heal_collector,
};

export async function create_and_wait(token, url, description, opts = {}){
    const name = opts.name
        || `studio-${domain_of(url).replace(/\./g, '-')}-${Date.now()}`;
    const {collector_id} = await api.create_collector(token, {name});
    await api.start_ai_build(token, collector_id, {url, description});
    const {outcome} = await api.poll_until({
        timeout_seconds: opts.timeout_seconds || BUILD_TIMEOUT_SECONDS,
        fetch_once: ()=>api.get_build_progress(token, collector_id),
        classify: classify_status,
        on_tick: opts.on_progress,
    });
    if (outcome != 'done')
        throw new Error(`Scraper generation ${outcome} for ${collector_id}`);
    return {collector_id, name};
}

// Heal reports success when the AI job finishes, not when the data is
// correct, so callers must always re-run and re-check afterwards.
export async function heal_collector(token, collector_id, prompt){
    await api.start_heal(token, collector_id, prompt);
    const {outcome} = await api.poll_until({
        timeout_seconds: BUILD_TIMEOUT_SECONDS,
        fetch_once: ()=>api.get_heal_progress(token, collector_id),
        classify: classify_status,
    });
    if (outcome == 'awaiting')
    {
        await api.resume_job(token, collector_id,
            {approve: true, auto_save: true});
        const resumed = await api.poll_until({
            timeout_seconds: BUILD_TIMEOUT_SECONDS,
            fetch_once: ()=>api.get_heal_progress(token, collector_id),
            classify: classify_status,
        });
        if (resumed.outcome != 'done')
            throw new Error(`Heal ${resumed.outcome} after approval`);
        return;
    }
    if (outcome != 'done')
        throw new Error(`Heal ${outcome} for ${collector_id}`);
}

const heal_prompt = reasons=>
    `The scraper is returning bad data. Problems found: ${reasons.join('; ')}. `
    +'The page layout has likely changed and the selectors need updating.';

export const ensure = async (token, url, description, opts = {})=>{
    const deps = {...default_deps, ...opts.deps};
    const auto_heal = opts.auto_heal !== false;
    const trace = [];

    let registry = deps.load();
    let entry = get_entry(registry, url);
    let created = false;

    if (!entry || entry.status != 'active')
    {
        trace.push(`Registry miss for ${domain_of(url)} — creating scraper`);
        const built = await deps.create(token, url, description, opts);
        entry = {
            collector_id: built.collector_id,
            name: built.name,
            source_url: url,
            description,
            created_at: new Date().toISOString(),
            status: 'active',
            schema_baseline: null,
            last_sample: null,
            heal_history: [],
        };
        registry = put_entry(registry, url, entry);
        created = true;
    }
    else
        trace.push(`Registry hit — reusing ${entry.collector_id}`);

    let records = await deps.run(token, entry.collector_id, url);
    let health = check_health(records, entry.schema_baseline);
    trace.push(`Ran ${entry.collector_id}: ${records?.length ?? 0} rows`);

    let healed = false;
    let escalated = false;

    if (!health.healthy && auto_heal)
    {
        trace.push(`Health FAILED: ${health.reasons.join('; ')} — healing`);
        healed = true;
        try {
            await deps.heal(token, entry.collector_id,
                heal_prompt(health.reasons));
            records = await deps.run(token, entry.collector_id, url);
            health = check_health(records, entry.schema_baseline);
            trace.push(`Post-heal verify: `
                +`${health.healthy ? 'OK' : health.reasons.join('; ')}`);
        } catch(e){
            trace.push(`Heal failed: ${e.message}`);
        }
        registry = record_heal(registry, url, {
            prompt: heal_prompt(health.reasons),
            status: health.healthy ? 'resolved' : 'failed',
        });

        // One escalation only. Each regeneration deletes the old collector, and
        // deletion is irreversible.
        if (!health.healthy)
        {
            trace.push('Still broken — escalating to a fresh scraper');
            escalated = true;
            const old_id = entry.collector_id;
            registry = abandon(registry, url);
            const rebuilt = await deps.create(token, url, description, opts);
            entry = {
                ...entry,
                collector_id: rebuilt.collector_id,
                name: rebuilt.name,
                created_at: new Date().toISOString(),
                status: 'active',
                schema_baseline: null,
            };
            registry = put_entry(registry, url, entry);
            registry = record_heal(registry, url, {
                prompt: 'escalated after failed heal',
                status: 'escalated',
                escalated: true,
                replaced_by: rebuilt.collector_id,
            });
            records = await deps.run(token, rebuilt.collector_id, url);
            health = check_health(records, null);
            trace.push(`Rebuilt ${old_id} as ${rebuilt.collector_id}: `
                +`${health.healthy ? 'OK' : health.reasons.join('; ')}`);
        }
    }

    if (health.healthy)
    {
        registry = put_entry(registry, url, {
            ...get_entry(registry, url),
            schema_baseline: health.schema,
            last_sample: records.slice(0, 3),
            last_run_at: new Date().toISOString(),
            last_row_count: records.length,
        });
    }

    deps.save(registry);
    return {
        domain: domain_of(url),
        collector_id: get_entry(registry, url).collector_id,
        created, healed, escalated, health, records, trace,
    };
};
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/scraper/ensure.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Point the cron at `ensure`**

Replace the body of the loop in `scripts/cron.js`:

```js
import {ensure} from '../scraper/ensure.js';

for (const [domain, entry] of Object.entries(registry))
{
    if (entry.status != 'active')
        continue;
    try {
        const res = await ensure(token, entry.source_url, entry.description);
        for (const line of res.trace)
            console.log(`${domain}: ${line}`);
        if (!res.health.healthy)
            failures++;
    } catch(e){
        failures++;
        console.error(`${domain}: FAILED — ${e.message}`);
    }
}
```

Remove the manual `registry.json` read/write from `cron.js` — `ensure` owns
persistence now. Domains are still iterated **sequentially**; the AI-Flow
concurrency cap makes parallel healing counterproductive.

A run that heals successfully must exit `0`. Only an unrecoverable result
(unhealthy after escalation, or a thrown error) counts as a failure.

- [ ] **Step 6: Commit**

```bash
git add scraper/ensure.js test/scraper/ensure.test.js scripts/cron.js
git commit -m "feat: ensure loop with heal verification and single escalation"
```

---

## Task 7: The seven lifecycle MCP tools

**Files:**
- Create: `scraper/tools.js`
- Modify: `server.js` (import + register)
- Modify: `tool_groups.js` (new group)

**Interfaces:**
- Consumes: `scraper/api.js`, `scraper/ensure.js`, `scraper/registry.js`
- Produces: `register_scraper_tools(addTool, {api_token})`

Tools, all `snake_case`, all returning a JSON string:

| Tool | Parameters | Notes |
|---|---|---|
| `scraper_create` | `url`, `description`, `name?` | Returns `{collector_id, status:'generating'}` **immediately**. Does not block. |
| `scraper_status` | `collector_id` | Polls build progress once, returns `{status, step}`. |
| `scraper_run` | `collector_id`, `url` | Returns records. |
| `scraper_heal` | `collector_id`, `prompt`, `auto_approve?` | Default `auto_approve: true`. |
| `scraper_approve` | `collector_id`, `reject?` | Manual gate. |
| `scraper_ensure` | `url`, `description` | The loop. Returns `{records, trace, health, ...}`. |
| `scraper_registry_list` | none | Domains, IDs, health, heal counts. |

- [ ] **Step 1: Write `scraper/tools.js`**

Copy the shape of `search_engine` at [server.js:201](server.js#L201) exactly.
One representative tool, to be followed for the rest:

```js
// scraper/tools.js
'use strict';
import {z} from 'zod';
import * as api from './api.js';
import {ensure} from './ensure.js';
import {load_registry} from './registry.js';
import {classify_status} from './requests.js';

const json = value=>JSON.stringify(value, null, 2);

export const register_scraper_tools = (addTool, {api_token})=>{
    addTool({
        name: 'scraper_create',
        description: 'Build a brand-new custom scraper for any public page '
            +'from a natural-language description, using Bright Data Scraper '
            +'Studio. Use this when no web_data_* tool covers the target '
            +'site. Returns a collector_id immediately; AI generation takes '
            +'5-10 minutes, so poll scraper_status before running it.',
        annotations: {
            title: 'Create Scraper',
            readOnlyHint: false,
            openWorldHint: true,
        },
        parameters: z.object({
            url: z.string().url()
                .describe('Public page the scraper should target'),
            description: z.string().max(500)
                .describe('What to extract, e.g. "product name, price, '
                    +'availability"'),
            name: z.string().optional()
                .describe('Optional template name'),
        }),
        execute: async ({url, description, name})=>{
            const {collector_id} = await api.create_collector(api_token,
                {name: name || `studio-${Date.now()}`});
            await api.start_ai_build(api_token, collector_id,
                {url, description});
            return json({
                collector_id,
                status: 'generating',
                next_step: 'Poll scraper_status until status is "done" '
                    +'(typically 5-10 minutes), then call scraper_run.',
            });
        },
    });

    // ... scraper_status, scraper_run, scraper_heal, scraper_approve,
    //     scraper_ensure, scraper_registry_list follow the same shape.
};
```

Remaining tool bodies:

- `scraper_status` — `const p = await api.get_build_progress(api_token, collector_id); return json({status: classify_status(p), step: p.step ?? null, completed_steps: p.completed_steps?.length ?? 0});`
- `scraper_run` — `return json(await api.run_collector(api_token, collector_id, url));`
- `scraper_heal` — call `heal_collector` from `ensure.js` when `auto_approve` is true, otherwise `api.start_heal` + one `get_heal_progress`, returning the status so the caller can decide.
- `scraper_approve` — `await api.resume_job(api_token, collector_id, {approve: !reject, auto_save: !reject}); return json({collector_id, approved: !reject});`
- `scraper_ensure` — `return json(await ensure(api_token, url, description));`
- `scraper_registry_list` — read `load_registry()` and return one row per domain: `{domain, collector_id, status, created_at, last_run_at, last_row_count, heal_count: entry.heal_history.length}`. Never return `last_sample` in full; it bloats the context.

- [ ] **Step 2: Register in `server.js`**

Add near the other imports:

```js
import {register_scraper_tools} from './scraper/tools.js';
```

And after the existing `addTool` calls, before the server starts:

```js
register_scraper_tools(addTool, {api_token});
```

- [ ] **Step 3: Register in `tool_groups.js`**

Add a group and include the tools in it:

```js
SCRAPER_STUDIO: {
    id: 'scraper_studio',
    name: 'Scraper Studio',
    description: 'Create, run, and self-heal custom scrapers for any '
        +'public site.',
    tools: [
        ...base_tools,
        'scraper_create',
        'scraper_status',
        'scraper_run',
        'scraper_heal',
        'scraper_approve',
        'scraper_ensure',
        'scraper_registry_list',
    ],
},
```

- [ ] **Step 4: Verify the tools load**

```bash
API_TOKEN=<key> node server.js
```
Expected: starts without error. Then connect from Claude Desktop or Claude Code
and confirm all seven appear in the tool list.

- [ ] **Step 5: End-to-end check**

Ask the connected agent: *"Use scraper_ensure to get the top stories from
news.ycombinator.com — title, points, author."*

Expected: registry hit on the seeded entry, a run, a healthy verdict, records
returned.

- [ ] **Step 6: Commit**

```bash
git add scraper/tools.js server.js tool_groups.js
git commit -m "feat: seven scraper studio lifecycle mcp tools"
```

---

## Task 8: CLI-parity tools

Six stateless tools that close the CLI-only gaps. Each is small; they are
grouped into one task because they share a file and a test run.

**Files:**
- Create: `account/tools.js`
- Modify: `server.js`, `tool_groups.js`

| Tool | Endpoint | Returns |
|---|---|---|
| `zones_list` | `GET /zone/get_active_zones` | Zone names, types, status |
| `budget_status` | `GET /customer/balance` | Balance and per-zone spend |
| `scrape_screenshot` | `POST /request` with `data_format: 'screenshot'` | Base64 PNG |
| `scrape_metadata` | `POST /request` with `data_format: 'json'` | Page metadata |
| `scrape_async` | `POST /request` with async flag | Job id for later polling |
| `discover_with_content` | their `discover` call + full page body | Ranked results with content |

- [ ] **Step 1: Confirm the account endpoints**

These are not in `scraper.ts`. Read
`reference/brightdata-cli/src/commands/zones.ts` and `budget.ts` for the exact
paths and response shapes before writing anything. Do not guess.

- [ ] **Step 2: Write `account/tools.js`**

Follow the same `addTool` shape as Task 7. Export
`register_account_tools(addTool, {api_token, unlocker_zone})`. Reuse their
existing `base_request` helper from `server.js` for the `/request` calls rather
than writing a second HTTP client — export it from `server.js` if needed.

- [ ] **Step 3: Register in `server.js` and `tool_groups.js`**

Add to a new `ACCOUNT` group and to the `advanced_scraping` group.

- [ ] **Step 4: Verify each tool returns real data**

Run the server and call each tool once from a connected agent. `zones_list`
should show four zones: `cli_unlocker`, `cli_browser`, `mcp_unlocker`,
`mcp_browser`.

- [ ] **Step 5: Commit**

```bash
git add account/tools.js server.js tool_groups.js
git commit -m "feat: zones, budget, scrape variants and discover with content"
```

---

## Task 9: Browser parity

Adds the seven verbs the CLI has and their MCP lacks. These extend **their**
`Browser_session`, so everything runs on the same Playwright connection their
existing 14 browser tools use — there is no second browser and no session
conflict.

**Files:**
- Modify: `browser_tools.js`
- Modify: `tool_groups.js`

| Tool | Playwright call |
|---|---|
| `scraping_browser_reload` | `page.reload()` |
| `scraping_browser_select_ref` | `locator.selectOption(value)` |
| `scraping_browser_check_ref` | `locator.check()` |
| `scraping_browser_uncheck_ref` | `locator.uncheck()` |
| `scraping_browser_hover_ref` | `locator.hover()` |
| `scraping_browser_cookies` | `context.cookies()` |
| `scraping_browser_close_session` | `browser.close()` |

- [ ] **Step 1: Read the existing ref-based tools**

`scraping_browser_click_ref` in `browser_tools.js` shows how a snapshot `ref` is
resolved to a Playwright locator. Copy that resolution exactly — refs are only
valid against the snapshot that produced them.

- [ ] **Step 2: Add the seven tools**

Same file, same `addTool` shape, same naming prefix so they group naturally
with the existing browser tools.

- [ ] **Step 3: Register in `tool_groups.js`**

Add all seven to the `BROWSER` group.

- [ ] **Step 4: Verify a full interaction chain**

From a connected agent: navigate to a public page with a form, snapshot, hover
an element, check a checkbox, select a dropdown option, read cookies, close the
session. Each step must act on the same page as the previous one.

- [ ] **Step 5: Commit**

```bash
git add browser_tools.js tool_groups.js
git commit -m "feat: browser reload, select, check, uncheck, hover, cookies, close"
```

---

## Task 10: Dashboard backend

**Files:**
- Create: `web/server.js`
- Create: `web/tool_schemas.js`
- Modify: `package.json` (add `express`, `@anthropic-ai/sdk`)

**Interfaces:**
- Consumes: `scraper/ensure.js`, `scraper/registry.js`
- Produces: HTTP API on port 3000

| Route | Purpose |
|---|---|
| `GET /api/registry` | Registry rows for the table |
| `GET /api/sample/:domain` | Full `last_sample` for one domain |
| `GET /api/heals` | Flattened heal history across domains, newest first |
| `POST /api/chat` | Anthropic tool-use loop, **streamed** |
| `POST /api/heal` | Manual force-heal, for live demos |

- [ ] **Step 1: Extract shared tool schemas**

`web/tool_schemas.js` holds the three schemas the chat agent exposes —
`scraper_ensure`, `scraper_heal`, `scraper_registry_list` — in Anthropic tool
format. Derive them from the same descriptions used in `scraper/tools.js`
rather than writing them twice.

- [ ] **Step 2: Write the Express server and the tool-use loop**

Standard Anthropic Messages API loop: send messages, if `stop_reason` is
`tool_use` execute the named tool, append a `tool_result`, repeat.

**Streaming is required, not optional.** `scraper_ensure` can block for 5-10
minutes on a create. Stream each trace line to the client as it happens
(server-sent events are sufficient) or the UI appears frozen.

- [ ] **Step 3: Verify**

```bash
API_TOKEN=<key> ANTHROPIC_API_KEY=<key> node web/server.js
curl localhost:3000/api/registry
```
Expected: JSON array with the seeded domain.

- [ ] **Step 4: Commit**

```bash
git add web/server.js web/tool_schemas.js package.json
git commit -m "feat: dashboard api with streaming chat agent"
```

---

## Task 11: Dashboard frontend

**Files:**
- Create: `web/frontend/index.html`, `app.js`, `style.css`

Build in priority order — each piece is useful before the next exists.

- [ ] **Step 1: Chat panel**

Message list, input box, and a live tool-use trace rendered inline as the
stream arrives (`Registry hit...`, `Running...`, `Health FAILED...`,
`Healing...`). This is the headline feature and the centerpiece of the demo.

- [ ] **Step 2: Registry table**

Domain, collector ID, created, last run, row count, health badge. Click a row
to expand the sample JSON from `GET /api/sample/:domain`.

- [ ] **Step 3: Heal event log**

Reverse-chronological across all domains from `GET /api/heals`. Show the
prompt, the outcome, and flag escalated entries distinctly — escalation is the
most interesting thing the system does and it should be visible at a glance.

- [ ] **Step 4: CI badge and stats strip**

Embed the shields.io badge for the workflow. Stats: total scrapers, total
heals, oldest continuously-running scraper.

- [ ] **Step 5: Verify at three widths**

320px, 768px, 1440px. No horizontal overflow at any of them.

- [ ] **Step 6: Commit**

```bash
git add web/frontend
git commit -m "feat: dashboard chat panel, registry table and heal log"
```

---

## Task 12: Documentation

**Files:**
- Modify: `assets/Tools.md`, `README.md`
- Create: `docs/sample-output.json`

- [ ] **Step 1: Add the 13 new tools to `Tools.md`**

Match their existing table formatting exactly.

- [ ] **Step 2: Rewrite the README header**

Required content:
- What this fork adds and why (the lifecycle gap, stated precisely)
- **Attribution:** which files are upstream, which are ours, MIT notice
- How Bright Data Scraper Studio is used — a hackathon submission requirement
- Setup: `API_TOKEN`, MCP client config, dashboard
- The self-healing flow, with the escalation path
- Honest limitations: escalation deletes the collector it abandons; create
  takes 5-10 minutes; the registry is single-account
- Link to the upstream PR
- **AI disclosure**, as the hackathon rules require

- [ ] **Step 3: Save a real sample output**

Commit an actual `scraper_ensure` result to `docs/sample-output.json` —
records, trace, and health verdict. Submissions require sample structured
output.

- [ ] **Step 4: Commit**

```bash
git add assets/Tools.md README.md docs/sample-output.json
git commit -m "docs: tool reference, readme, sample output"
```

---

## Task 13: Upstream PR branch

Do this **last**, and only once Tasks 1-12 are working. A rushed PR against the
repo whose maintainers may be judging is worse than no PR.

**Files (on `pr/scraper-lifecycle` only):**
- Create: `scraper_tools.js` (single flat file, no registry, no `ensure`)
- Modify: `server.js`, `tool_groups.js`, `assets/Tools.md`

- [ ] **Step 1: Branch from upstream, not from our work**

```bash
git fetch upstream main
git checkout -b pr/scraper-lifecycle upstream/main
```

Branching from `main` would drag the dashboard, the registry, and the CI cron
into the diff, and the PR would be closed unread.

- [ ] **Step 2: Port the four stateless tools**

`scraper_create`, `scraper_run`, `scraper_heal`, `scraper_approve` only. One
file, no new directories, no state. Copy the REST logic from `scraper/api.js`,
inlined — the PR should not require a new module layout.

Explicitly excluded, and the PR description should say why: `scraper_ensure`,
`scraper_registry_list`, and the health checks all require cross-request state,
which their hosted multi-tenant server cannot provide.

- [ ] **Step 3: Update `Tools.md` and `tool_groups.js`**

Four rows, one group entry. Nothing else.

- [ ] **Step 4: Verify the diff is small**

```bash
git diff upstream/main --stat
```
Expected: 4 files, roughly 250 lines added. If it is larger, something from
`main` leaked in.

- [ ] **Step 5: Open the PR**

Description must: name the gap precisely (69 tools, no lifecycle; it exists
only in the CLI and the Studio UI), explain the fix, link to this project as
evidence the approach works in practice, and state what was deliberately left
out and why.

- [ ] **Step 6: Record it**

Add the PR URL to the README's upstream section with honest status, e.g.
"open, pending review as of Aug 23."

---

## Self-Review

**Spec coverage.** Every item in the locked scope maps to a task: lifecycle
tools (7), registry (4), health (5), ensure with heal-verify-escalate (6), CLI
parity (8), browser parity (9), dashboard (10, 11), CI cron (3), upstream PR
(13), docs and sample output (12).

**Deliberate exclusions, with reasons.** Row-count anomaly detection — needs
many runs to build a baseline, fires spuriously before then; schema drift and
null ratio both produce signal from a single run. Multi-escalation — no delete
API, so each attempt permanently orphans a collector.

**Ordering.** Task 3 (CI) ships before the logic it will eventually call,
because unattended run history is the one asset that cannot be compressed —
it accrues in wall-clock time. Task 6 upgrades it in place.

**Known unknowns, each with a verification step rather than a guess.**
The `/dca/trigger_immediate` and `/dca/get_result` envelope shapes (Task 2,
Step 6). The `zones` and `budget` endpoints (Task 8, Step 1). Both are checked
against live responses or the CLI source before code depends on them.
