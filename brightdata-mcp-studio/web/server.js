'use strict'; /*jslint node:true es9:true*/
// Read-only API behind the submission dashboard.
//
// Everything here reads registry.json, which the MCP tools and the scheduled
// cron both write. The registry is re-read on every request rather than cached
// at startup, so a cron run that heals a scraper shows up in the dashboard
// without restarting anything.
//
// Nothing in this file can change a scraper. The dashboard is evidence, not a
// control panel - every action lives in the MCP tools, where an agent drives
// it.
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {load_registry} from '../scraper/registry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Every scraped record echoes the trigger input back. health.js leaves it out
// of the schema for that reason, so showing it as an extracted field would
// contradict the health model the rest of the project runs on.
const without_input = record=>{
    const {input, ...fields} = record || {};
    return fields;
};

const to_row = ([domain, entry])=>({
    domain,
    collector_id: entry.collector_id,
    description: entry.description,
    source_url: entry.source_url,
    status: entry.status,
    created_at: entry.created_at,
    last_run_at: entry.last_run_at || null,
    last_row_count: entry.last_row_count ?? null,
    schema_baseline: entry.schema_baseline || [],
    heal_count: (entry.heal_history || []).length,
});

app.get('/api/registry', (req, res)=>{
    res.json(Object.entries(load_registry()).map(to_row));
});

// The full sample is deliberately its own route. It is the largest thing in
// the registry and the table does not need it until a row is opened.
app.get('/api/sample/:domain', (req, res)=>{
    const entry = load_registry()[req.params.domain];
    if (!entry)
        return res.status(404).json({error: 'No scraper for that domain'});
    res.json((entry.last_sample || []).map(without_input));
});

// Flattened across domains so the dashboard can show one repair timeline for
// the whole system rather than a log per site.
app.get('/api/heals', (req, res)=>{
    const heals = Object.entries(load_registry()).flatMap(([domain, entry])=>
        (entry.heal_history || []).map(event=>({...event, domain})));
    heals.sort((a, b)=>(b.timestamp || '').localeCompare(a.timestamp || ''));
    res.json(heals);
});

app.get('/api/stats', (req, res)=>{
    const entries = Object.values(load_registry());
    const active = entries.filter(e=>e.status != 'abandoned');
    const created = active.map(e=>e.created_at).filter(Boolean).sort();
    res.json({
        scrapers: active.length,
        abandoned: entries.length-active.length,
        heals: entries.reduce((n, e)=>n+(e.heal_history || []).length, 0),
        rows: active.reduce((n, e)=>n+(e.last_row_count || 0), 0),
        watching_since: created[0] || null,
        last_run_at: active.map(e=>e.last_run_at).filter(Boolean).sort().pop()
            || null,
    });
});

app.use(express.static(path.join(here, 'frontend')));

app.listen(PORT, ()=>
    console.log(`Dashboard on http://localhost:${PORT}`));
