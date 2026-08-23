'use strict'; /*jslint node:true es9:true*/
// The registry maps a website to the scraper we built for it.
//
// This matters more than it looks: the account can list its collectors
// (GET /dca/collectors_list), but that tells you the id and name of each, not
// which site it targets or what it extracts. registry.json is the only place
// the domain -> collector_id mapping exists anywhere. Lose it and every scraper
// you own becomes an anonymous ID you can no longer match to a site.
//
// Every function that changes the registry returns a new object rather than
// editing the one it was given. Callers hold snapshots across long-running
// operations - a heal can take ten minutes - and silent mutation underneath
// them is a debugging nightmare.
//
// Entry shape:
//   {
//       collector_id:    'c_x',
//       name:            'studio-example-com-1787114432',
//       source_url:      'https://example.com/shop',
//       description:     'name, price, in stock',
//       created_at:      '2026-08-19T10:00:00Z',
//       status:          'active' | 'abandoned',
//       schema_baseline: ['name', 'price'],   // fields seen on the last good run
//       last_sample:     [...],               // up to 3 records, for the dashboard
//       last_run_at:     '2026-08-19T10:04:00Z',
//       last_row_count:  35,
//       heal_history:    [...],
//       cleanups:        [...],               // orphans this site's escalations deleted
//   }
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Resolved against this file, not the working directory. MCP clients launch
// the server from wherever the config lives, so a relative path would point
// somewhere else and quietly load an empty registry - which reads as "no
// scrapers exist" and rebuilds every one of them from scratch.
const server_dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PATH = process.env.REGISTRY_PATH
    || path.join(server_dir, 'registry.json');

// Scrapers are keyed by domain, not by full URL, so a request for any page on
// a site finds the scraper built for that site.
export const domain_of = url=>{
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch(e){
        throw new Error(`"${url}" is not a valid url`);
    }
};

export const load_registry = (path = DEFAULT_PATH)=>{
    if (!fs.existsSync(path))
        return {};
    return JSON.parse(fs.readFileSync(path, 'utf8'));
};

export const save_registry = (registry, path = DEFAULT_PATH)=>
    fs.writeFileSync(path, JSON.stringify(registry, null, 4)+'\n');

export const get_entry = (registry, url)=>registry[domain_of(url)];

export const put_entry = (registry, url, entry)=>({
    ...registry,
    [domain_of(url)]: entry,
});

const update_entry = (registry, url, changes)=>{
    const domain = domain_of(url);
    const entry = registry[domain];
    if (!entry)
        throw new Error(`No registry entry for ${domain}`);
    return {...registry, [domain]: {...entry, ...changes}};
};

// How many runs to keep per domain. Enough to draw a trend and to still show
// the break after a few days of six-hourly runs; small enough that the
// registry stays a file a person can read.
const RUN_HISTORY_LIMIT = 30;

// Appends one run to a domain's history - every run, not just the good ones.
// A broken run is the single most interesting point on the graph, and it is
// the one the baseline fields below deliberately refuse to record.
//
// `source` tells the dashboard which loop produced this point: 'ensure' is
// the full reuse/run/heal/verify/escalate pass (the 6-hourly cron, a direct
// scraper_ensure call, or an escalation triggered from the fast path);
// 'fast_check' is the cheap scrape-and-check with no AI job (the 15-minute
// schedule, or a manual scraper_check_now). Without this tag every point
// looks identical and the two loops are indistinguishable in the history.
export const record_run = (registry, url,
    {rows, healthy, fields, source = 'ensure'})=>
{
    const existing = get_entry(registry, url)?.run_history || [];
    return update_entry(registry, url, {
        last_checked_at: new Date().toISOString(),
        run_history: [...existing, {
            at: new Date().toISOString(),
            rows,
            healthy,
            fields,
            source,
        }].slice(-RUN_HISTORY_LIMIT),
    });
};

// Appends one attempt to a domain's repair log. Keeping the full history -
// prompt, outcome, whether it escalated - is what lets the dashboard show what
// actually happened to a scraper over time.
export const record_heal = (registry, url, event)=>{
    const existing = get_entry(registry, url)?.heal_history || [];
    return update_entry(registry, url, {
        heal_history: [...existing, {
            timestamp: new Date().toISOString(),
            auto_triggered: true,
            escalated: false,
            replaced_by: null,
            ...event,
        }],
    });
};

// Appends one cleanup to a domain's record. Escalation deletes the collector
// it abandoned and records it here, so the account never quietly loses a
// scraper - the registry keeps the proof of what was deleted and when.
export const record_cleanup = (registry, url, event)=>{
    const existing = get_entry(registry, url)?.cleanups || [];
    return update_entry(registry, url, {
        cleanups: [...existing, {
            timestamp: new Date().toISOString(),
            ...event,
        }],
    });
};

// Marks a scraper as dead without removing it. The ID stays in the account
// until the escalation flow deletes it; recording it here (and in the heal
// history) is what tells us which orphans are ours to clean up.
export const abandon = (registry, url)=>
    update_entry(registry, url, {status: 'abandoned'});

export const active_entries = registry=>
    Object.entries(registry).filter(([, entry])=>entry.status != 'abandoned');

// --- Heal lock ---------------------------------------------------------
//
// Escalation deletes the collector it abandons, and that delete is
// irreversible - so the fast health-check path, a manual trigger, and the
// six-hourly cron must never be allowed to heal the same domain at once.
//
// The lock lives on its own field (locked_at), not on `status`. `status`
// already carries real meaning elsewhere ('abandoned' is what tells ensure()
// a collector is dead and a fresh one is needed) - overloading it with a
// transient 'healing' value would make a locked, abandoned entry look
// reusable the moment it's locked. Keeping the lock separate means it can be
// acquired and released without disturbing that decision at all.
//
// A held lock is trusted for LOCK_STALE_MS and then treated as gone. Without
// that, a crashed process would leave a domain locked forever.
const LOCK_STALE_MS = 20*60*1000;

export const is_locked = entry=>Boolean(entry?.locked_at)
    && Date.now()-new Date(entry.locked_at).getTime() < LOCK_STALE_MS;

// A missing entry has nothing to protect yet - the race this guards against
// is two callers healing the same *existing* collector, not two callers
// creating the same new one - so this is a no-op rather than an error.
export const acquire_lock = (registry, url)=>{
    const domain = domain_of(url);
    const entry = registry[domain];
    if (!entry)
        return registry;
    if (is_locked(entry))
        throw new Error(`${domain} is already being healed`);
    return {...registry, [domain]: {...entry, locked_at: new Date().toISOString()}};
};

export const release_lock = (registry, url, final_status)=>{
    const domain = domain_of(url);
    const entry = registry[domain];
    if (!entry)
        return registry;
    const {locked_at, ...rest} = entry;
    return {...registry, [domain]: {...rest, status: final_status}};
};
