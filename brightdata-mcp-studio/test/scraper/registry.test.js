'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    domain_of, get_entry, put_entry, record_heal, abandon, active_entries,
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
    // There is no delete API, so an abandoned collector still exists in the
    // account. Keeping the id is the only record that it is ours.
    const r0 = put_entry({}, 'https://a.com', {collector_id: 'c_1'});
    const r1 = abandon(r0, 'https://a.com');
    assert.equal(r1['a.com'].status, 'abandoned');
    assert.equal(r1['a.com'].collector_id, 'c_1');
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
