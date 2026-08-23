'use strict'; /*jslint node:true es9:true*/
// Runs every scraper in the registry, unattended, on a schedule.
//
// This is the whole project's claim under test: a scraper that notices when it
// breaks and repairs itself without anyone watching. ensure() does the real
// work - reuse, run, check, heal, verify, escalate - so this file only decides
// what to run and what counts as a failed run.
//
// Domains are handled one at a time on purpose. Bright Data caps how many AI
// jobs an account can run at once, so healing two sites in parallel makes both
// wait instead of one.
import {load_registry, active_entries} from '../scraper/registry.js';
import {ensure} from '../scraper/ensure.js';

const token = process.env.API_TOKEN;
if (!token)
    throw new Error('API_TOKEN is required');

const registry = load_registry();
const entries = active_entries(registry);

if (!entries.length)
{
    console.log('Registry is empty - nothing to run');
    process.exit(0);
}

let failures = 0;

for (const [domain, entry] of entries)
{
    try {
        const result = await ensure(token, entry.source_url, entry.description);

        // A locked domain means the fast health-check path or a manual
        // trigger is already healing it. That is the lock doing its job, not
        // a fault - counting it as a failure would turn the build red for
        // exactly the case this exists to prevent.
        if (result.skipped)
        {
            console.log(`${domain}: skipped - ${result.reason}`);
            continue;
        }

        for (const line of result.trace)
            console.log(`${domain}: ${line}`);

        // A run that healed itself is a success - that is the feature working,
        // not a fault. Only data that is still wrong after every repair
        // attempt should turn the build red.
        if (!result.health.healthy)
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
