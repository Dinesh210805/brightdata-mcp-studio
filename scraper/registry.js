'use strict'; /*jslint node:true es9:true*/
// The registry maps a website to the scraper we built for it.
//
// This matters more than it looks: Bright Data has no API to list the
// collectors on your account. registry.json is the only place the
// domain -> collector_id mapping exists anywhere. Lose it and every scraper
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
//   }
import fs from 'node:fs';

const DEFAULT_PATH = process.env.REGISTRY_PATH || 'registry.json';

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

// Marks a scraper as dead without removing it. Bright Data exposes no way to
// delete a collector, so the ID stays in the account forever - recording it is
// the only way to know which orphans are ours.
export const abandon = (registry, url)=>
    update_entry(registry, url, {status: 'abandoned'});

export const active_entries = registry=>
    Object.entries(registry).filter(([, entry])=>entry.status != 'abandoned');
