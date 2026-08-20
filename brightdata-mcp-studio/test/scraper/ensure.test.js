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
    // Exactly one rebuild. Each one orphans a collector permanently, so this
    // must never loop.
    assert.equal(creates, 1);
    assert.equal(res.health.healthy, false);
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
