'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fast_check} from '../../scraper/fast_check.js';

const entry = {
    collector_id: 'c_1',
    source_url: 'https://a.com',
    description: 'title, price',
    status: 'active',
    schema_baseline: ['price', 'title'],
};

const good = [{title: 'A', price: '$1'}];
const broken = [{title: 'A', price: null}];

const make_deps = overrides=>({
    load: ()=>({'a.com': {...entry}}),
    save: ()=>{},
    run: async ()=>good,
    ensure: async ()=>{ throw new Error('ensure should not have been called'); },
    ...overrides,
});

test('healthy data returns without ever calling ensure()', async ()=>{
    let ensure_calls = 0;
    const res = await fast_check('token', 'https://a.com', {
        deps: make_deps({ensure: async ()=>{ ensure_calls++; }}),
    });
    assert.equal(res.healthy, true);
    assert.deepEqual(res.reasons, []);
    assert.equal(res.escalated_to_heal, false);
    assert.equal(ensure_calls, 0);
});

test('a healthy check is recorded in the registry, tagged fast_check', async ()=>{
    let saved = null;
    await fast_check('token', 'https://a.com', {
        deps: make_deps({save: registry=>{ saved = registry; }}),
    });
    const domain_entry = saved['a.com'];
    assert.ok(domain_entry.last_checked_at);
    const point = domain_entry.run_history.at(-1);
    assert.equal(point.source, 'fast_check');
    assert.equal(point.healthy, true);
    assert.equal(point.rows, 1);
});

test('unhealthy data calls ensure() exactly once and returns its outcome', async ()=>{
    let ensure_calls = 0;
    const res = await fast_check('token', 'https://a.com', {
        deps: make_deps({
            run: async ()=>broken,
            ensure: async (token, url, description)=>{
                ensure_calls++;
                assert.equal(url, 'https://a.com');
                assert.equal(description, 'title, price');
                return {
                    domain: 'a.com', collector_id: 'c_1', created: false,
                    healed: true, escalated: false,
                    health: {healthy: true, reasons: [], schema: ['price', 'title']},
                    records: good, trace: ['healed'],
                };
            },
        }),
    });
    assert.equal(ensure_calls, 1);
    assert.equal(res.escalated_to_heal, true);
    assert.equal(res.healthy, true);
    assert.equal(res.healed, true);
});

test('ensure() reporting the domain locked is passed straight through', async ()=>{
    const res = await fast_check('token', 'https://a.com', {
        deps: make_deps({
            run: async ()=>broken,
            ensure: async ()=>({domain: 'a.com', skipped: true, reason: 'locked'}),
        }),
    });
    assert.equal(res.escalated_to_heal, true);
    assert.equal(res.skipped, true);
    assert.equal(res.reason, 'locked');
});

test('no registry entry short-circuits before run or ensure', async ()=>{
    let ran = false;
    const res = await fast_check('token', 'https://unknown.com', {
        deps: make_deps({
            load: ()=>({}),
            run: async ()=>{ ran = true; return good; },
        }),
    });
    assert.equal(res.healthy, false);
    assert.deepEqual(res.reasons, ['no registry entry']);
    assert.equal(res.escalated_to_heal, false);
    assert.equal(ran, false);
});
