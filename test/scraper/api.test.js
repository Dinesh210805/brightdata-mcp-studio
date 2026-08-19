'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    poll_until, with_ai_retry, classify_raw, is_realtime_limit, parse_body,
} from '../../scraper/api.js';

test('poll_until returns as soon as the outcome is not running', async ()=>{
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

test('poll_until surfaces a non-done terminal outcome', async ()=>{
    const res = await poll_until({
        fetch_once: async ()=>({status: 'failed'}),
        classify: ()=>'failed',
        timeout_seconds: 10,
        interval_ms: 1,
    });
    assert.equal(res.outcome, 'failed');
});

test('poll_until gives up once the deadline passes', async ()=>{
    await assert.rejects(()=>poll_until({
        fetch_once: async ()=>({status: 'collecting'}),
        classify: ()=>'running',
        timeout_seconds: 0,
        interval_ms: 1,
    }), /timed out/i);
});

test('poll_until reports progress through on_tick', async ()=>{
    const ticks = [];
    let calls = 0;
    await poll_until({
        fetch_once: async ()=>({status: ++calls < 3 ? 'collecting' : 'done'}),
        classify: p=>p.status=='done' ? 'done' : 'running',
        timeout_seconds: 10,
        interval_ms: 1,
        on_tick: t=>ticks.push(t.attempt),
    });
    assert.deepEqual(ticks, [1, 2]);
});

test('with_ai_retry waits out the concurrent-job cap', async ()=>{
    let attempts = 0;
    const out = await with_ai_retry(async ()=>{
        if (++attempts < 3)
            throw new Error('cannot run more than 2 jobs in parallel');
        return 'ok';
    }, {max_retries: 4, base_ms: 1, max_ms: 2});
    assert.equal(out, 'ok');
    assert.equal(attempts, 3);
});

test('with_ai_retry gives up after max_retries', async ()=>{
    let attempts = 0;
    await assert.rejects(()=>with_ai_retry(async ()=>{
        attempts++;
        throw new Error('cannot run more than 2 jobs in parallel');
    }, {max_retries: 2, base_ms: 1, max_ms: 2}), /jobs in parallel/);
    assert.equal(attempts, 3); // first try + 2 retries
});

test('with_ai_retry does not retry unrelated errors', async ()=>{
    let attempts = 0;
    await assert.rejects(()=>with_ai_retry(async ()=>{
        attempts++;
        throw new Error('401 unauthorized');
    }, {max_retries: 4, base_ms: 1}), /unauthorized/);
    assert.equal(attempts, 1);
});

test('classify_raw treats 202, empty and building as not ready', ()=>{
    assert.equal(classify_raw({status: 202, body: ''}), 'running');
    assert.equal(classify_raw({status: 200, body: '   '}), 'running');
    assert.equal(classify_raw({status: 200, body: '{"status":"building"}'}),
        'running');
    assert.equal(classify_raw({status: 500, body: 'boom'}), 'running');
});

test('classify_raw treats a real payload as ready', ()=>{
    assert.equal(classify_raw({status: 200, body: '[{"title":"A"}]'}), 'done');
    assert.equal(classify_raw({status: 200, body: '[]'}), 'done');
});

test('is_realtime_limit detects the page-limit sentinel', ()=>{
    assert.equal(is_realtime_limit(
        [{error: 'Realtime job limit exceeded for this page'}]), true);
});

test('is_realtime_limit ignores real data', ()=>{
    assert.equal(is_realtime_limit([{title: 'A'}]), false);
    assert.equal(is_realtime_limit([]), false);
    assert.equal(is_realtime_limit(null), false);
    // one bad row among good ones is data with an error, not a limit response
    assert.equal(is_realtime_limit(
        [{error: 'realtime job limit'}, {title: 'A'}]), false);
});

test('parse_body returns json when it can, raw text when it cannot', ()=>{
    assert.deepEqual(parse_body('[{"a":1}]'), [{a: 1}]);
    assert.equal(parse_body('not json'), 'not json');
    assert.equal(parse_body(''), '');
});
