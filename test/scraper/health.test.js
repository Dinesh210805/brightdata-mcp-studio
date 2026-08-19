'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schema_of, check_health} from '../../scraper/health.js';

// Shaped like a real Scraper Studio response: the trigger input is echoed
// back on every record.
const good = [
    {title: 'A', price: '$1', input: {url: 'x'}},
    {title: 'B', price: '$2', input: {url: 'x'}},
];

test('schema_of sorts field names and drops the echoed input key', ()=>{
    assert.deepEqual(schema_of(good), ['price', 'title']);
});

test('schema_of unions fields across records', ()=>{
    assert.deepEqual(schema_of([{a: 1}, {b: 2}]), ['a', 'b']);
});

test('good data matching its baseline is healthy', ()=>{
    const res = check_health(good, ['price', 'title']);
    assert.equal(res.healthy, true);
    assert.deepEqual(res.reasons, []);
    assert.deepEqual(res.schema, ['price', 'title']);
});

test('a run with no records is unhealthy', ()=>{
    const res = check_health([], ['price', 'title']);
    assert.equal(res.healthy, false);
    assert.match(res.reasons[0], /no records/i);
});

test('a non-array response is unhealthy', ()=>{
    // Some failures come back as an error object rather than an array.
    assert.equal(check_health({error: 'boom'}, null).healthy, false);
    assert.equal(check_health(null, null).healthy, false);
});

test('a field that stopped extracting is named in the reason', ()=>{
    const res = check_health(
        [{title: 'A', price: null}, {title: 'B', price: ''}],
        ['price', 'title']);
    assert.equal(res.healthy, false);
    assert.match(res.reasons.join(' '), /price.*100%/i);
});

test('a field that disappeared is reported as schema drift', ()=>{
    const res = check_health([{title: 'A'}], ['price', 'title']);
    assert.equal(res.healthy, false);
    assert.match(res.reasons.join(' '), /missing.*price/i);
});

test('a few empty values are tolerated', ()=>{
    // Real pages have gaps. Only a field that is empty almost everywhere
    // means the selector broke.
    const records = Array.from({length: 10},
        (_, i)=>({title: 'T'+i, price: i < 2 ? null : '$'+i}));
    assert.equal(check_health(records, ['price', 'title']).healthy, true);
});

test('the first run establishes a baseline instead of failing', ()=>{
    const res = check_health(good, null);
    assert.equal(res.healthy, true);
    assert.deepEqual(res.schema, ['price', 'title']);
});

test('records with no extracted fields are unhealthy', ()=>{
    // What a bad rebuild produces: rows exist, but nothing was pulled out of
    // them. With no baseline to compare against, this would otherwise pass.
    const res = check_health([{}, {}, {}], null);
    assert.equal(res.healthy, false);
    assert.match(res.reasons.join(' '), /no extracted fields/i);
});

test('records that are null in every field are unhealthy', ()=>{
    const res = check_health(
        [{title: null, price: null}, {title: null, price: null}], null);
    assert.equal(res.healthy, false);
});

test('a new extra field does not count as breakage', ()=>{
    // Sites add fields. That is not a broken scraper, so only fields that
    // vanish count as drift.
    const res = check_health(
        [{title: 'A', price: '$1', stock: 3}], ['price', 'title']);
    assert.equal(res.healthy, true);
});
