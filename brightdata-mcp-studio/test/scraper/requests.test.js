'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    build_collector_request, build_ai_request, build_heal_request,
    build_resume_request, classify_status, build_collectors_list_path,
    build_delete_collector_path,
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

test('build_heal_request sends prompt, not description', ()=>{
    // The build endpoint takes `description`; this one rejects it with
    // {"validation_errors":["\"description\" is not allowed"]}. A real
    // lobste.rs break failed to heal because of exactly that, and this test
    // asserted the wrong shape, so it held the bug in place instead of
    // catching it. Shape taken from the CLI's build_refactor_request.
    assert.deepEqual(build_heal_request('price is null'),
        {prompt: 'price is null', custom_input: []});
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

test('build_collectors_list_path omits search when there is none', ()=>{
    assert.equal(build_collectors_list_path(), '/dca/collectors_list');
    assert.equal(build_collectors_list_path(''), '/dca/collectors_list');
    assert.equal(build_collectors_list_path(undefined), '/dca/collectors_list');
});

test('build_collectors_list_path encodes the search term', ()=>{
    assert.equal(build_collectors_list_path('amazon'),
        '/dca/collectors_list?search=amazon');
    assert.equal(build_collectors_list_path('my scraper'),
        '/dca/collectors_list?search=my%20scraper');
});

test('build_delete_collector_path targets one collector by id', ()=>{
    assert.equal(build_delete_collector_path('c_abc123'),
        '/dca/collector/c_abc123');
    assert.equal(build_delete_collector_path('c_abc123', 'orphan'),
        '/dca/collector/c_abc123?reason=orphan');
    assert.equal(build_delete_collector_path('c_abc123', 'no longer needed'),
        '/dca/collector/c_abc123?reason=no%20longer%20needed');
});
