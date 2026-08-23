'use strict'; /*jslint node:true es9:true*/
// A cheap way to notice a scraper has broken, for use between cron cycles.
//
// This deliberately does not fingerprint or diff the page. A hash of the DOM
// cannot be scoped to only the part the AI scraper actually depends on, and it
// false-positives constantly - a cookie banner, an A/B test, a rotating
// promo all change the page without breaking the scraper. check_health() is
// already the thing ensure() trusts to answer "is the data actually right",
// so this reuses it as the sole signal, at a fraction of the cost: a real
// scrape and a health check, no AI job.
//
// It only ever escalates to the expensive path - ensure(), which can build,
// heal, and rebuild - when check_health() actually reports the data is wrong.
// Never on a timer, never on a guess.
import * as api from './api.js';
import {load_registry, save_registry, get_entry} from './registry.js';
import {check_health} from './health.js';
import {ensure} from './ensure.js';

const default_deps = {
    load: load_registry,
    save: save_registry,
    run: api.run_collector,
    ensure,
};

export const fast_check = async (token, url, opts = {})=>{
    const deps = {...default_deps, ...opts.deps};

    const registry = deps.load();
    const entry = get_entry(registry, url);

    // This path only ever checks a scraper that already exists. Building one
    // from nothing is what ensure()'s own miss-handling is for, triggered
    // explicitly rather than as a side effect of a health check.
    if (!entry)
    {
        return {
            healthy: false,
            reasons: ['no registry entry'],
            escalated_to_heal: false,
        };
    }

    const records = await deps.run(token, entry.collector_id, url);
    const health = check_health(records, entry.schema_baseline);

    if (health.healthy)
        return {healthy: true, reasons: [], escalated_to_heal: false};

    // ensure() handles its own lock - if the fast path, a manual trigger and
    // the cron all land here for the same domain, only one actually heals.
    const result = await deps.ensure(token, url, entry.description);
    return {
        healthy: result.health?.healthy ?? false,
        reasons: result.health?.reasons ?? health.reasons,
        escalated_to_heal: true,
        ...result,
    };
};
