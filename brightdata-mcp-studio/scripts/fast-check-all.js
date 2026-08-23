'use strict'; /*jslint node:true es9:true*/
// Runs the cheap health check (Task 14c) against every active scraper, on the
// tighter schedule. This is what actually shortens the window a break can go
// unnoticed from six hours down to fifteen minutes - the six-hourly workflow
// still exists and still does a full ensure() pass, this just checks more
// often in between.
//
// fast_check() decides everything: a real scrape and check_health(), and it
// only calls ensure() itself when the data is actually wrong. This file is
// the same thin loop-and-report shim as scripts/cron.js, aimed at fast_check
// instead of ensure directly.
import {load_registry, active_entries} from '../scraper/registry.js';
import {fast_check} from '../scraper/fast_check.js';

const token = process.env.API_TOKEN;
if (!token)
    throw new Error('API_TOKEN is required');

const registry = load_registry();
const entries = active_entries(registry);

if (!entries.length)
{
    console.log('Registry is empty - nothing to check');
    process.exit(0);
}

let failures = 0;

for (const [domain, entry] of entries)
{
    try {
        const result = await fast_check(token, entry.source_url);

        if (result.skipped)
        {
            console.log(`${domain}: skipped - ${result.reason}`);
            continue;
        }

        if (!result.escalated_to_heal)
        {
            console.log(`${domain}: healthy, no repair needed`);
            continue;
        }

        // Escalated to a full ensure() - its trace is the interesting part,
        // same as the six-hourly run reports it.
        for (const line of result.trace ?? [])
            console.log(`${domain}: ${line}`);

        if (!result.healthy)
        {
            failures++;
            console.error(`${domain}: STILL BROKEN after repair attempts`);
        }
    } catch(e){
        failures++;
        console.error(`${domain}: FAILED - ${e.message}`);
    }
}

process.exit(failures ? 1 : 0);
