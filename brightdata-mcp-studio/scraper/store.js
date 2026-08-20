'use strict'; /*jslint node:true es9:true*/
// Keeps the rows a run produced, so the scrapers leave data behind and not
// just a health verdict.
//
// The registry deliberately stores three records per site - enough to show a
// sample and to spot drift, useless as a dataset. Without this, a scheduled
// run that collects a few hundred rows every six hours throws away nearly all
// of them, and "fresh data every night" is not true of anything.
//
// Two files per run:
//
//   data/<domain>/latest.json    overwritten every time - what a consumer reads
//   data/<domain>/<when>.json    kept forever - the history
//
// latest.json exists so reading the current data is one fetch rather than
// listing a directory and sorting filenames. Anything that can make an HTTP
// request - a bot, a CLI, another agent - can consume this without knowing
// how the archive is laid out.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {domain_of} from './registry.js';

// Same resolution rule as the registry: against this file, not the working
// directory, because MCP clients launch the server from wherever their config
// lives. DATA_DIR moves it somewhere durable - which an npx install wants,
// since its server directory is inside node_modules.
const server_dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = process.env.DATA_DIR || path.join(server_dir, 'data');

// ':' is legal in an ISO timestamp and illegal in a Windows filename.
const stamp = at=>at.replace(/:/g, '-');

const domain_dir = (url, dir)=>path.join(dir, domain_of(url));

export const save_run = (url, records, {dir = DEFAULT_DIR, at} = {})=>{
    // A run that returned nothing is a fact about the scraper, which the
    // registry already records. Writing it here would overwrite good data with
    // an empty file, which is worse than having no file.
    if (!Array.isArray(records) || !records.length)
        return null;

    const when = at || new Date().toISOString();
    const target = domain_dir(url, dir);
    fs.mkdirSync(target, {recursive: true});

    const body = JSON.stringify(records, null, 2)+'\n';
    const latest = path.join(target, 'latest.json');
    const archive = path.join(target, `${stamp(when)}.json`);
    fs.writeFileSync(archive, body);
    fs.writeFileSync(latest, body);

    return {latest, archive, rows: records.length, at: when};
};

// Oldest first, so a caller reading history walks forward through time.
export const list_runs = (url, {dir = DEFAULT_DIR} = {})=>{
    const target = domain_dir(url, dir);
    if (!fs.existsSync(target))
        return [];

    return fs.readdirSync(target)
        .filter(name=>name.endsWith('.json') && name != 'latest.json')
        .sort()
        .map(name=>({at: name.replace(/\.json$/, ''),
            file: path.join(target, name)}));
};

export const read_latest = (url, {dir = DEFAULT_DIR} = {})=>{
    const latest = path.join(domain_dir(url, dir), 'latest.json');
    if (!fs.existsSync(latest))
        return null;
    return JSON.parse(fs.readFileSync(latest, 'utf8'));
};
