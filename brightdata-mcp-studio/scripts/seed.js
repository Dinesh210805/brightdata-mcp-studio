'use strict'; /*jslint node:true es9:true*/
// Builds the starting set of scrapers.
//
// Every target here sits outside Bright Data's pre-built library on purpose.
// That is a hackathon rule, and it is also the whole point: the scrapers worth
// generating are the ones nobody has already written. A judge can re-run this
// against their own account and get the same registry.
//
// Sequential, like the cron and for the same reason. Bright Data caps how many
// AI jobs an account may run at once, and a build takes 5-10 minutes, so
// starting them together just makes every one of them queue.
import {ensure} from '../scraper/ensure.js';

const TARGETS = [
    {
        url: 'https://news.ycombinator.com',
        description: 'top stories: title, points, author',
    },
    {
        url: 'https://lobste.rs',
        description: 'front page stories: title, score, author, comment count',
    },
    {
        url: 'https://www.gutenberg.org/browse/scores/top',
        description: 'most downloaded books: title, author, download count',
    },
    {
        url: 'https://www.python.org/jobs/',
        description: 'job listings: job title, company, location, job type',
    },
];

const token = process.env.API_TOKEN;
if (!token)
    throw new Error('API_TOKEN is required');

let failures = 0;

for (const {url, description} of TARGETS)
{
    console.log(`\n=== ${url} ===`);
    try {
        const result = await ensure(token, url, description);
        for (const line of result.trace)
            console.log(`  ${line}`);
        if (!result.health.healthy)
        {
            failures++;
            console.error('  STILL BROKEN after repair attempts');
        }
    } catch(e){
        failures++;
        console.error(`  FAILED - ${e.message}`);
    }
}

console.log(`\nDone. ${TARGETS.length-failures}/${TARGETS.length} healthy.`);
process.exit(failures ? 1 : 0);
