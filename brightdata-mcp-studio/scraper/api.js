'use strict'; /*jslint node:true es9:true*/
// HTTP layer for Bright Data's Scraper Studio (DCA) API.
//
// Two things here are not obvious and are the reason this file exists at all:
//
//   1. Creating a scraper is two calls. POST /dca/collector returns a
//      collector_id in about a second; POST .../automate_template then starts
//      an AI build that takes 5-10 minutes. That split is what lets callers
//      hand back an ID immediately instead of blocking.
//
//   2. Running a scraper has two paths. The realtime path is fast but refuses
//      pages over a size limit, answering with an error row instead of data.
//      That is not a failure - it means "use the batch endpoint" - so
//      run_collector falls through to batch automatically.
//
// Endpoint shapes are ported from the Bright Data CLI, which is the reference
// implementation: reference/brightdata-cli/src/commands/scraper.ts
import axios from 'axios';
import {
    build_collector_request, build_ai_request, build_heal_request,
    build_resume_request, build_collectors_list_path,
    build_delete_collector_path,
} from './requests.js';

const BASE_URL = 'https://api.brightdata.com';

const POLL_INTERVAL_MS = 5_000;
const BATCH_POLL_INTERVAL_MS = 10_000;

// Bright Data caps how many AI jobs one account may run at once. Hitting the
// cap is normal under load, so we wait it out with a growing delay rather than
// failing the caller. Same numbers the CLI uses.
const AI_RETRY_BASE_MS = 30_000;
const AI_RETRY_MAX_MS = 240_000;
const AI_RETRY_DEFAULT = 4;
const CONCURRENCY_CAP_ERROR = /cannot run more than \d+ jobs in parallel/i;

// Marker inside a realtime result row telling us the page was too big.
const REALTIME_LIMIT_MARKER = 'realtime job limit';

const sleep = ms=>new Promise(resolve=>setTimeout(resolve, ms));

// JSON request/response. Errors are re-thrown with the endpoint and the
// server's own message attached, because "Request failed with status code 400"
// on its own tells a user nothing.
const request = async (token, method, path, data)=>{
    try {
        const res = await axios({
            url: `${BASE_URL}${path}`,
            method,
            data,
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
        });
        return res.data;
    } catch(e){
        const detail = e.response?.data?.error || e.response?.data || e.message;
        const text = typeof detail=='string' ? detail : JSON.stringify(detail);
        throw new Error(`${method} ${path} failed: ${text}`);
    }
};

// Result polling needs the raw status code - a 202 means "not ready yet",
// which axios would either hide or turn into an exception. So the polling
// endpoints use fetch directly and classify the response themselves.
const fetch_raw = async (token, path)=>{
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {authorization: `Bearer ${token}`},
    });
    return {status: res.status, body: await res.text()};
};

export const parse_body = body=>{
    const trimmed = (body || '').trim();
    try {
        return JSON.parse(trimmed);
    } catch(e){
        return trimmed;
    }
};

// A result endpoint is "done" only when it hands back a real payload. A 202,
// any error code, an empty body, or an explicit {status: 'building'} all mean
// the job is still working.
export const classify_raw = ({status, body})=>{
    if (status == 202 || status < 200 || status >= 300)
        return 'running';
    const trimmed = (body || '').trim();
    if (!trimmed)
        return 'running';
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed == 'object' && !Array.isArray(parsed)
            && parsed.status == 'building')
        {
            return 'running';
        }
    } catch(e){
        // Not JSON. Some collectors return plain text, which is still a
        // finished result.
    }
    return 'done';
};

// The realtime endpoint signals "page too large" by returning rows that are
// all errors. One error among real rows is just a bad row, so every row must
// carry the marker for this to count.
export const is_realtime_limit = data=>Array.isArray(data) && data.length > 0
    && data.every(row=>typeof row?.error == 'string'
        && row.error.toLowerCase().includes(REALTIME_LIMIT_MARKER));

// Retries only the concurrent-job cap, and only for AI jobs. Any other error
// is a real problem and is thrown straight through.
export const with_ai_retry = async (fn, opts = {})=>{
    const max_retries = opts.max_retries ?? AI_RETRY_DEFAULT;
    const base_ms = opts.base_ms ?? AI_RETRY_BASE_MS;
    const max_ms = opts.max_ms ?? AI_RETRY_MAX_MS;
    for (let attempt = 0;; attempt++)
    {
        try {
            return await fn();
        } catch(e){
            if (attempt >= max_retries || !CONCURRENCY_CAP_ERROR.test(e.message))
                throw e;
            await sleep(Math.min(base_ms*2**attempt, max_ms));
        }
    }
};

// Calls fetch_once until classify says something other than 'running', or the
// deadline passes. `classify` decides what counts as finished, so the same
// loop serves both the AI progress endpoints and the result endpoints.
export const poll_until = async ({fetch_once, classify, timeout_seconds,
    interval_ms = POLL_INTERVAL_MS, on_tick})=>
{
    const deadline = Date.now()+timeout_seconds*1000;
    for (let attempt = 1;; attempt++)
    {
        const result = await fetch_once();
        const outcome = classify(result);
        if (outcome != 'running')
            return {outcome, result};
        if (Date.now() >= deadline)
            throw new Error(`Polling timed out after ${timeout_seconds}s`);
        on_tick?.({attempt, result});
        await sleep(interval_ms);
    }
};

// --- Scraper lifecycle -----------------------------------------------------

// Step one of creating a scraper. Returns almost immediately; the collector
// exists but is empty until start_ai_build finishes.
export const create_collector = async (token, opts)=>{
    const res = await request(token, 'POST', '/dca/collector',
        build_collector_request(opts));
    const collector_id = res?.collector_id || res?.collector || res?.id;
    if (!collector_id)
        throw new Error('No collector_id returned from /dca/collector');
    return {collector_id, name: opts.name};
};

// Step two. Kicks off the AI build and returns straight away - poll
// get_build_progress to follow it.
export const start_ai_build = (token, collector_id, {url, description})=>
    with_ai_retry(()=>request(token, 'POST',
        `/dca/collectors/${collector_id}/automate_template`,
        build_ai_request(url, description)));

export const get_build_progress = (token, collector_id)=>
    request(token, 'GET',
        `/dca/collectors/${collector_id}/automate_template/progress`);

export const start_heal = (token, collector_id, prompt)=>
    with_ai_retry(()=>request(token, 'POST',
        `/dca/collectors/${collector_id}/refactor_template`,
        build_heal_request(prompt)));

export const get_heal_progress = (token, collector_id)=>
    request(token, 'GET',
        `/dca/collectors/${collector_id}/refactor_template/progress`);

// Answers the approval gate a heal stops at. approve:false rejects the fix and
// leaves the scraper as it was.
export const resume_job = (token, collector_id, {approve, auto_save})=>
    request(token, 'POST',
        `/dca/collectors/${collector_id}/resume_automation_job`,
        build_resume_request(approve, auto_save));

// --- Inventory and cleanup --------------------------------------------------

// Lists every collector in the account. Unlike the registry, this knows
// nothing about which site a scraper targets - it is the account's raw view,
// useful for finding orphans the registry has lost track of.
export const list_collectors = (token, {search} = {})=>
    request(token, 'GET', build_collectors_list_path(search));

// Permanently removes one collector. The API answers with plain text "OK",
// not JSON, so this returns the raw string. Only callers deleting collectors
// our own escalation flow abandoned should ever use it.
export const delete_collector = async (token, collector_id, {reason} = {})=>{
    const path = build_delete_collector_path(collector_id, reason);
    let res;
    try {
        res = await axios({
            url: `${BASE_URL}${path}`,
            method: 'DELETE',
            headers: {authorization: `Bearer ${token}`},
        });
    } catch(e){
        // A collector that is already gone is as good as deleted, so a 404
        // counts as success and keeps the cleanup idempotent.
        if (e.response?.status == 404)
            return 'OK';
        const detail = e.response?.data || e.message;
        throw new Error(`DELETE ${path} failed: ${detail}`);
    }
    return res.data;
};

// --- Running ---------------------------------------------------------------

// Batch path: slower, but no page-size limit. Used for multiple URLs and as
// the automatic fallback when realtime refuses a large page.
const run_batch = async (token, collector_id, urls, timeout_seconds)=>{
    const trigger = await request(token, 'POST',
        `/dca/trigger?collector=${encodeURIComponent(collector_id)}`,
        urls.map(url=>({url})));
    const collection_id = trigger?.collection_id;
    if (!collection_id)
        throw new Error('No collection_id returned from /dca/trigger');
    const {result} = await poll_until({
        timeout_seconds,
        interval_ms: BATCH_POLL_INTERVAL_MS,
        fetch_once: ()=>fetch_raw(token,
            `/dca/dataset?id=${encodeURIComponent(collection_id)}`),
        classify: classify_raw,
    });
    return parse_body(result.body);
};

// Runs a scraper against one URL and returns the extracted records. Tries the
// fast realtime path first and falls back to batch if the page is too large -
// callers never have to care which path ran.
export const run_collector = async (token, collector_id, url, opts = {})=>{
    const timeout_seconds = opts.timeout_seconds ?? 600;
    const batch_timeout_seconds = opts.batch_timeout_seconds ?? 3600;

    const trigger = await request(token, 'POST',
        `/dca/trigger_immediate?collector=${encodeURIComponent(collector_id)}`,
        {url});
    const response_id = trigger?.response_id;
    if (!response_id)
        throw new Error('No response_id returned from /dca/trigger_immediate');

    const {result} = await poll_until({
        timeout_seconds,
        fetch_once: ()=>fetch_raw(token,
            `/dca/get_result?response_id=${encodeURIComponent(response_id)}`),
        classify: classify_raw,
        on_tick: opts.on_tick,
    });

    const data = parse_body(result.body);
    if (is_realtime_limit(data))
    {
        opts.on_fallback?.();
        return run_batch(token, collector_id, [url], batch_timeout_seconds);
    }
    return data;
};
