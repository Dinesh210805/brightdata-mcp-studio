'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    build_collector_request, build_ai_request, build_heal_request,
    build_resume_request, classify_status,
} from '../../scraper/requests.js';

test('build_collector_request fills in a stub delivery webhook', ()=>{
    const req = build_collector_request({name: 'studio-example-com-1'});
    assert.equal(req.name, 'studio-example-com-1');
    assert.equal(req.deliver.type, 'webhook');
    assert.equal(req.deliver.endpoint, 'https://example.com/webhook');
    assert.deepEqual(req.deliver.filename,
        {template: 'data', extension: 'json'});
});

test('build_collector_request accepts a real delivery webhook', ()=>{
    const req = build_collector_request({
        name: 'x',
        deliver_webhook: 'https://my-app.test/hook',
    });
    assert.equal(req.deliver.endpoint, 'https://my-app.test/hook');
});

test('build_ai_request wraps the single url in an array', ()=>{
    assert.deepEqual(
        build_ai_request('https://a.com', 'title and price'),
        {description: 'title and price', urls: ['https://a.com']});
});

test('build_heal_request sends the prompt as the description', ()=>{
    assert.deepEqual(build_heal_request('price is null'),
        {description: 'price is null'});
});

test('build_resume_request sends auto_save only when approving', ()=>{
    assert.deepEqual(build_resume_request(true, true),
        {message: true, auto_save: true});
    assert.deepEqual(build_resume_request(true, false), {message: true});
    assert.deepEqual(build_resume_request(false, true), {message: false});
});

test('classify_status maps every status the API can return', ()=>{
    assert.equal(classify_status({status: 'done'}), 'done');
    assert.equal(classify_status({status: 'pending_answer'}), 'awaiting');
    assert.equal(classify_status({status: 'failed'}), 'failed');
    assert.equal(classify_status({status: 'error'}), 'failed');
    assert.equal(classify_status({status: 'cancelled'}), 'failed');
    assert.equal(classify_status({status: 'collecting'}), 'running');
});

test('classify_status treats an unreadable response as still running', ()=>{
    // A progress endpoint that returns {} or null has not failed - it just
    // has nothing to report yet. Treating it as failure would abort healthy
    // jobs during their first few seconds.
    assert.equal(classify_status({}), 'running');
    assert.equal(classify_status(null), 'running');
    assert.equal(classify_status(undefined), 'running');
});
