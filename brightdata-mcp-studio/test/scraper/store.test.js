'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {save_run, list_runs, read_latest} from '../../scraper/store.js';

const temp_dir = ()=>fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));

const rows = [{title: 'a', points: 1}, {title: 'b', points: 2}];

test('save_run writes latest.json and a dated copy under the domain', ()=>{
    const dir = temp_dir();
    const written = save_run('https://news.ycombinator.com/x', rows,
        {dir, at: '2026-08-20T12:00:00.000Z'});

    assert.equal(JSON.parse(fs.readFileSync(written.latest, 'utf8')).length, 2);
    assert.deepEqual(JSON.parse(fs.readFileSync(written.archive, 'utf8')), rows);
    assert.match(written.latest, /news\.ycombinator\.com/);
});

test('the archive filename has no characters windows rejects', ()=>{
    const dir = temp_dir();
    const {archive} = save_run('https://a.com', rows,
        {dir, at: '2026-08-20T12:00:00.000Z'});

    assert.ok(!path.basename(archive).includes(':'));
    assert.match(path.basename(archive), /^2026-08-20T12-00-00/);
});

test('a second run keeps the first archive and replaces latest', ()=>{
    const dir = temp_dir();
    save_run('https://a.com', rows, {dir, at: '2026-08-20T12:00:00.000Z'});
    save_run('https://a.com', [{title: 'c'}],
        {dir, at: '2026-08-20T18:00:00.000Z'});

    assert.equal(list_runs('https://a.com', {dir}).length, 2);
    assert.deepEqual(read_latest('https://a.com', {dir}), [{title: 'c'}]);
});

test('runs are keyed by domain, so any page on a site lands together', ()=>{
    const dir = temp_dir();
    save_run('https://a.com/one', rows, {dir, at: '2026-08-20T12:00:00.000Z'});
    save_run('https://www.a.com/two', rows,
        {dir, at: '2026-08-20T13:00:00.000Z'});

    assert.equal(list_runs('https://a.com', {dir}).length, 2);
});

test('list_runs is sorted oldest first and read_latest copes with no data', ()=>{
    const dir = temp_dir();
    assert.deepEqual(list_runs('https://nothing.com', {dir}), []);
    assert.equal(read_latest('https://nothing.com', {dir}), null);

    save_run('https://a.com', rows, {dir, at: '2026-08-20T18:00:00.000Z'});
    save_run('https://a.com', rows, {dir, at: '2026-08-20T06:00:00.000Z'});

    const [first, second] = list_runs('https://a.com', {dir});
    assert.ok(first.at < second.at, `${first.at} should sort before ${second.at}`);
});

test('save_run refuses to write an empty result', ()=>{
    const dir = temp_dir();
    assert.equal(save_run('https://a.com', [], {dir}), null);
    assert.equal(save_run('https://a.com', null, {dir}), null);
    assert.deepEqual(list_runs('https://a.com', {dir}), []);
});
