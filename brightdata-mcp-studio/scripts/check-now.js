'use strict'; /*jslint node:true es9:true*/
// The manual, on-demand half of the fast health-check loop. The scheduled
// cron (scripts/cron.js) runs every domain every six hours; this checks one
// domain right now, from a workflow_dispatch input, without waiting for the
// next tick.
//
// fast_check() already decides everything - a cheap scrape and check_health(),
// escalating to a full ensure() only if the data actually looks wrong. This
// file is just the CLI shim: read the domain, call it, report the outcome.
import {load_registry, get_entry} from '../scraper/registry.js';
import {fast_check} from '../scraper/fast_check.js';

const token = process.env.API_TOKEN;
if (!token)
    throw new Error('API_TOKEN is required');

const domain = process.argv[2];
if (!domain)
    throw new Error('Usage: node scripts/check-now.js <domain>');

const registry = load_registry();
const entry = get_entry(registry, `https://${domain}`);
if (!entry)
    throw new Error(`No registry entry for ${domain}`);

const result = await fast_check(token, entry.source_url);

if (result.skipped)
{
    console.log(`${domain}: skipped - ${result.reason}`);
    process.exit(0);
}

if (result.trace)
{
    for (const line of result.trace)
        console.log(`${domain}: ${line}`);
}
else
    console.log(`${domain}: checked, ${result.healthy ? 'healthy' : 'still wrong'}`);

process.exit(result.healthy ? 0 : 1);
