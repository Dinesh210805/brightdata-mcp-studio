'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import {
    domain_of, get_entry, put_entry, record_heal, record_run, record_cleanup,
    abandon, active_entries,
} from '../../scraper/registry.js';

test('domain_of ignores scheme, www, port, case and path', ()=>{
    assert.equal(domain_of('https://www.Example.com/shop?a=1'), 'example.com');
    assert.equal(domain_of('http://news.ycombinator.com'),
        'news.ycombinator.com');
    assert.equal(domain_of('https://shop.example.com:8443/x'),
        'shop.example.com');
});

test('domain_of rejects anything that is not a url', ()=>{
    assert.throws(()=>domain_of('not a url'), /not a valid url/i);
});

test('get_entry matches on domain, not on the exact url', ()=>{
    const registry = put_entry({}, 'https://a.com/page-one',
        {collector_id: 'c_1'});
    assert.equal(get_entry(registry, 'https://a.com/somewhere-else')
        .collector_id, 'c_1');
});

test('put_entry returns a new registry and leaves the old one alone', ()=>{
    const before = {};
    const after = put_entry(before, 'https://a.com', {collector_id: 'c_1'});
    assert.deepEqual(before, {});
    assert.equal(after['a.com'].collector_id, 'c_1');
});

test('record_heal appends without touching the original', ()=>{
    const r0 = put_entry({}, 'https://a.com',
        {collector_id: 'c_1', heal_history: []});
    const r1 = record_heal(r0, 'https://a.com', {status: 'resolved'});
    assert.equal(r0['a.com'].heal_history.length, 0);
    assert.equal(r1['a.com'].heal_history.length, 1);
    assert.equal(r1['a.com'].heal_history[0].status, 'resolved');
});

test('record_heal fills in defaults but lets the caller override them', ()=>{
    const r0 = put_entry({}, 'https://a.com', {collector_id: 'c_1'});
    const event = record_heal(r0, 'https://a.com',
        {status: 'escalated', escalated: true, replaced_by: 'c_2'})
        ['a.com'].heal_history[0];
    assert.equal(event.auto_triggered, true);
    assert.equal(event.escalated, true);
    assert.equal(event.replaced_by, 'c_2');
    assert.ok(event.timestamp);
});

test('abandon marks the entry but keeps the old collector id', ()=>{
    // The id stays on the entry until the escalation flow deletes the
    // collector; keeping it is the record that it is ours to clean up.
    const r0 = put_entry({}, 'https://a.com', {collector_id: 'c_1'});
    const r1 = abandon(r0, 'https://a.com');
    assert.equal(r1['a.com'].status, 'abandoned');
    assert.equal(r1['a.com'].collector_id, 'c_1');
});

test('record_cleanup appends without touching the original', ()=>{
    const r0 = put_entry({}, 'https://a.com',
        {collector_id: 'c_1', cleanups: []});
    const r1 = record_cleanup(r0, 'https://a.com',
        {collector_id: 'c_1', deleted: true});
    assert.equal(r0['a.com'].cleanups.length, 0);
    assert.equal(r1['a.com'].cleanups.length, 1);
    assert.equal(r1['a.com'].cleanups[0].collector_id, 'c_1');
    assert.equal(r1['a.com'].cleanups[0].deleted, true);
});

test('record_cleanup timestamps each cleanup and keeps failures', ()=>{
    let registry = put_entry({}, 'https://a.com', {collector_id: 'c_1'});
    registry = record_cleanup(registry, 'https://a.com',
        {collector_id: 'c_1', deleted: false, error: 'network down'});
    registry = record_cleanup(registry, 'https://a.com',
        {collector_id: 'c_1', deleted: true});

    const cleanups = get_entry(registry, 'https://a.com').cleanups;
    assert.equal(cleanups.length, 2);
    assert.equal(cleanups[0].deleted, false);
    assert.equal(cleanups[0].error, 'network down');
    assert.ok(cleanups.every(c=>c.timestamp), 'each cleanup is timestamped');
});

test('updating a domain with no entry fails loudly', ()=>{
    assert.throws(()=>abandon({}, 'https://nope.com'), /no registry entry/i);
});

test('active_entries skips abandoned scrapers', ()=>{
    let registry = put_entry({}, 'https://a.com',
        {collector_id: 'c_1', status: 'active'});
    registry = put_entry(registry, 'https://b.com',
        {collector_id: 'c_2', status: 'abandoned'});
    assert.deepEqual(active_entries(registry).map(([domain])=>domain),
        ['a.com']);
});

test('the registry is found regardless of working directory', async ()=>{
    // MCP clients start the server from wherever their config lives. A path
    // relative to cwd would load an empty registry and silently rebuild every
    // scraper - a 5-10 minute AI job each, duplicating collectors that are
    // still in the account.
    const {load_registry} = await import('../../scraper/registry.js');
    const original_cwd = process.cwd();
    try {
        process.chdir(os.tmpdir());
        assert.doesNotThrow(()=>load_registry());
    } finally {
        process.chdir(original_cwd);
    }
});

test('record_run keeps failed runs, not just good ones', ()=>{
    // The broken run is the interesting point on the graph. Baseline fields
    // are deliberately only written on a healthy run, so if the history
    // dropped failures too, a break would leave no trace anywhere.
    let registry = put_entry({}, 'https://a.com',
        {collector_id: 'c_1', status: 'active'});
    registry = record_run(registry, 'https://a.com',
        {rows: 60, healthy: true, fields: ['title']});
    registry = record_run(registry, 'https://a.com',
        {rows: 60, healthy: false, fields: []});

    const history = get_entry(registry, 'https://a.com').run_history;
    assert.equal(history.length, 2);
    assert.deepEqual(history.map(r=>r.healthy), [true, false]);
    assert.ok(history[0].at, 'each run is timestamped');
});

test('record_run caps history so the registry stays readable', ()=>{
    let registry = put_entry({}, 'https://a.com',
        {collector_id: 'c_1', status: 'active'});
    for (let i = 0; i<35; i++)
    {
        registry = record_run(registry, 'https://a.com',
            {rows: i, healthy: true, fields: []});
    }

    const history = get_entry(registry, 'https://a.com').run_history;
    assert.equal(history.length, 30);
    // The cap drops the oldest, never the newest.
    assert.equal(history.at(-1).rows, 34);
    assert.equal(history[0].rows, 5);
});
