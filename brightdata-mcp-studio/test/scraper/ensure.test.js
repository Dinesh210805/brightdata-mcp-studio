'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensure} from '../../scraper/ensure.js';

const existing_entry = {
    collector_id: 'c_1',
    source_url: 'https://a.com',
    description: 'title, price',
    status: 'active',
    schema_baseline: ['price', 'title'],
    heal_history: [],
};

const good = [{title: 'A', price: '$1'}];
const broken = [{title: 'A', price: null}];

// The real api/registry modules are swapped out here so the loop's decisions
// can be tested without touching the network or the filesystem.
const make_deps = overrides=>({
    load: ()=>({'a.com': {...existing_entry}}),
    save: ()=>{},
    run: async ()=>good,
    create: async ()=>({collector_id: 'c_new', name: 'rebuilt'}),
    heal: async ()=>{},
    remove: async ()=>{},
    // Stubbed, or the loop writes real files into data/ on every test run.
    store: ()=>null,
    ...overrides,
});

test('a known site with good data is just run', async ()=>{
    const res = await ensure('token', 'https://a.com', 'title, price',
        {deps: make_deps()});
    assert.equal(res.created, false);
    assert.equal(res.healed, false);
    assert.equal(res.escalated, false);
    assert.equal(res.health.healthy, true);
    assert.equal(res.collector_id, 'c_1');
    assert.deepEqual(res.records, good);
});

test('an unknown site gets a scraper built for it', async ()=>{
    const res = await ensure('token', 'https://new-site.com', 'title, price',
        {deps: make_deps({load: ()=>({})})});
    assert.equal(res.created, true);
    assert.equal(res.collector_id, 'c_new');
});

test('an abandoned entry is treated as if there were none', async ()=>{
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            load: ()=>({'a.com': {...existing_entry, status: 'abandoned'}}),
        }),
    });
    assert.equal(res.created, true);
    assert.equal(res.collector_id, 'c_new');
});

test('broken data is healed and then verified by running again', async ()=>{
    let runs = 0;
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({run: async ()=>++runs == 1 ? broken : good}),
    });
    assert.equal(res.healed, true);
    assert.equal(res.escalated, false);
    assert.equal(res.health.healthy, true);
    // Two runs: the one that found the problem, and the one that confirmed
    // the fix. Healing without re-running would report a false success.
    assert.equal(runs, 2);
});

test('the heal prompt names the fields that broke', async ()=>{
    let prompt = '';
    await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            heal: async (token, id, p)=>{ prompt = p; },
        }),
    });
    assert.match(prompt, /price/);
});

test('data still broken after healing triggers one rebuild', async ()=>{
    let creates = 0;
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            create: async ()=>{
                creates++;
                return {collector_id: 'c_new', name: 'rebuilt'};
            },
        }),
    });
    assert.equal(res.escalated, true);
    assert.equal(res.collector_id, 'c_new');
    // Exactly one rebuild. Each one deletes the collector it abandoned, so
    // this must never loop.
    assert.equal(creates, 1);
    assert.equal(res.health.healthy, false);
});

test('escalation deletes the abandoned collector and records it', async ()=>{
    let deleted_ids = [];
    let saved = null;
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            remove: async (token, id)=>{ deleted_ids.push(id); },
            save: registry=>{ saved = registry; },
        }),
    });

    // The old collector is ours (this flow healed and gave up on it), so
    // deleting it is safe, and the deletion is written into the registry.
    assert.deepEqual(deleted_ids, ['c_1']);
    const cleanup = saved['a.com'].cleanups.at(-1);
    assert.equal(cleanup.collector_id, 'c_1');
    assert.equal(cleanup.deleted, true);
    assert.ok(cleanup.timestamp);
    assert.match(res_trace(res), /Deleted the abandoned scraper c_1/);
});

test('a failed deletion is recorded and does not break the rebuild', async ()=>{
    let saved = null;
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            remove: async ()=>{ throw new Error('network down'); },
            save: registry=>{ saved = registry; },
        }),
    });

    // The rebuild still completes and the failure is on the record, so the
    // orphan is never silently forgotten.
    assert.equal(res.escalated, true);
    assert.equal(res.collector_id, 'c_new');
    const cleanup = saved['a.com'].cleanups.at(-1);
    assert.equal(cleanup.collector_id, 'c_1');
    assert.equal(cleanup.deleted, false);
    assert.equal(cleanup.error, 'network down');
    assert.match(res_trace(res), /Could not delete the abandoned scraper c_1/);
});

const res_trace = res=>res.trace.join(' ');

test('a domain already being healed is skipped, not retried', async ()=>{
    let ran = false;
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            load: ()=>({'a.com': {
                ...existing_entry, locked_at: new Date().toISOString(),
            }}),
            run: async ()=>{ ran = true; return good; },
        }),
    });
    assert.equal(res.skipped, true);
    assert.equal(res.reason, 'locked');
    assert.equal(ran, false);
});

test('a stale lock does not block a new run', async ()=>{
    const stale = new Date(Date.now()-21*60*1000).toISOString();
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            load: ()=>({'a.com': {...existing_entry, locked_at: stale}}),
        }),
    });
    assert.equal(res.skipped, undefined);
    assert.equal(res.health.healthy, true);
});

test('the lock is released even when the run throws', async ()=>{
    let saved = null;
    await assert.rejects(ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            save: registry=>{ saved = registry; },
            run: async ()=>{ throw new Error('network down'); },
        }),
    }));
    assert.equal(saved['a.com'].locked_at, undefined);
});

test('a successful run releases the lock with status active', async ()=>{
    let saved = null;
    await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({save: registry=>{ saved = registry; }}),
    });
    assert.equal(saved['a.com'].locked_at, undefined);
    assert.equal(saved['a.com'].status, 'active');
});

test('a rebuild that is still broken releases the lock as abandoned', async ()=>{
    let saved = null;
    await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            save: registry=>{ saved = registry; },
        }),
    });
    assert.equal(saved['a.com'].locked_at, undefined);
    assert.equal(saved['a.com'].status, 'abandoned');
});

test('a rebuild that works is reported healthy', async ()=>{
    let runs = 0;
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({run: async ()=>++runs <= 2 ? broken : good}),
    });
    assert.equal(res.escalated, true);
    assert.equal(res.health.healthy, true);
});

test('a heal that throws still escalates instead of giving up', async ()=>{
    const res = await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            heal: async ()=>{ throw new Error('AI job failed'); },
        }),
    });
    assert.equal(res.escalated, true);
    assert.match(res.trace.join(' '), /AI job failed/);
});

test('auto_heal false reports the problem without repairing it', async ()=>{
    let healed = false;
    const res = await ensure('token', 'https://a.com', 'title, price', {
        auto_heal: false,
        deps: make_deps({
            run: async ()=>broken,
            heal: async ()=>{ healed = true; },
        }),
    });
    assert.equal(healed, false);
    assert.equal(res.healed, false);
    assert.equal(res.health.healthy, false);
});

test('a healthy run records its baseline and sample', async ()=>{
    let saved = null;
    await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({save: registry=>{ saved = registry; }}),
    });
    const entry = saved['a.com'];
    assert.deepEqual(entry.schema_baseline, ['price', 'title']);
    assert.equal(entry.last_row_count, 1);
    assert.ok(entry.last_run_at);
});

test('every repair attempt is written to the heal history', async ()=>{
    let saved = null;
    await ensure('token', 'https://a.com', 'title, price', {
        deps: make_deps({
            run: async ()=>broken,
            save: registry=>{ saved = registry; },
        }),
    });
    const history = saved['a.com'].heal_history;
    assert.equal(history.length, 2); // the heal, then the escalation
    assert.equal(history[0].status, 'failed');
    assert.equal(history[1].escalated, true);
    assert.equal(history[1].replaced_by, 'c_new');
});

test('the trace explains what happened in order', async ()=>{
    const res = await ensure('token', 'https://a.com', 'title, price',
        {deps: make_deps()});
    assert.match(res.trace[0], /reusing c_1/i);
    assert.match(res.trace[1], /1 row/i);
});

test('asking for a different description throws instead of destroying the scraper', async ()=>{
    await assert.rejects(
        ensure('token', 'https://a.com', 'different description', {deps: make_deps()}),
        /There is already a scraper for a.com, built for "title, price"/
    );
});

