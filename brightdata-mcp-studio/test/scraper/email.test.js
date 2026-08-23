'use strict'; /*jslint node:true es9:true*/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {email_configured, notify_break, notify_digest} from '../../scraper/email.js';

test('email_configured is false with no RESEND_API_KEY or ALERT_EMAIL_TO set', ()=>{
    // The test environment never sets these, so this also doubles as proof
    // that nothing here makes a real network call during the test suite.
    assert.equal(email_configured(), false);
});

test('notify_break composes a subject naming the domain and lists the reasons', async ()=>{
    let sent = null;
    await notify_break('producthunt.com',
        ['Schema drift: missing upvote_count'],
        {send: async msg=>{ sent = msg; return true; }});

    assert.match(sent.subject, /producthunt\.com/);
    assert.match(sent.text, /upvote_count/);
});

test('notify_break marks a fatal problem as not auto-repairable', async ()=>{
    let sent = null;
    await notify_break('a.com', ['Bright Data could not crawl the page'],
        {fatal: true, send: async msg=>{ sent = msg; return true; }});

    assert.match(sent.subject.toLowerCase(), /attention|cannot|fatal/);
});

test('notify_digest summarizes healthy vs broken counts', async ()=>{
    let sent = null;
    await notify_digest([
        {domain: 'a.com', healthy: true, rows: 12},
        {domain: 'b.com', healthy: false, rows: 0},
        {domain: 'c.com', healthy: true, rows: 3},
    ], {send: async msg=>{ sent = msg; return true; }});

    assert.match(sent.subject, /2\/3/);
    assert.match(sent.text, /a\.com/);
    assert.match(sent.text, /b\.com/);
    assert.match(sent.text, /STILL BROKEN/);
});

test('notify_digest reports full health without alarming language', async ()=>{
    let sent = null;
    await notify_digest([{domain: 'a.com', healthy: true, rows: 5}],
        {send: async msg=>{ sent = msg; return true; }});
    assert.doesNotMatch(sent.subject, /broken/i);
});
