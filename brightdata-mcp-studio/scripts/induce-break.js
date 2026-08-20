'use strict'; /*jslint node:true es9:true*/
// Makes a scraper break on purpose, so the repair loop can be seen working.
//
// Waiting for a real site to redesign itself is not something a deadline
// allows, and a project whose whole claim is "it repairs itself" cannot ship
// with an empty repair log. So this induces the one thing that is honest to
// induce: the expectation.
//
// It adds a field to the schema baseline that the site does not return. That
// is the only authored value. Everything downstream is the real path -
// check_health notices the field is missing, turns that into the repair
// prompt, Bright Data rewrites the scraper, and a second run decides whether
// it worked. Nothing is mocked and no result is written by hand.
//
// The heal entry is marked `induced` afterwards so the dashboard can say so.
// A repair log that hides how its breaks happened is worth less than one that
// admits it.
//
//   node scripts/induce-break.js <domain> <field>
import {load_registry, save_registry} from '../scraper/registry.js';
import {ensure} from '../scraper/ensure.js';

const [, , domain, field] = process.argv;

if (!domain || !field)
{
    console.error('usage: node scripts/induce-break.js <domain> <field>');
    console.error('  e.g. node scripts/induce-break.js lobste.rs comment_count');
    process.exit(1);
}

const token = process.env.API_TOKEN;
if (!token)
    throw new Error('API_TOKEN is required');

const before = load_registry();
const entry = before[domain];

if (!entry)
{
    console.error(`No scraper for ${domain}. Registry has: `
        +`${Object.keys(before).join(', ') || '(nothing)'}`);
    process.exit(1);
}

if (!entry.schema_baseline?.length)
{
    console.error(`${domain} has no baseline yet - it needs one good run `
        +'before it can be broken against it.');
    process.exit(1);
}

if (entry.schema_baseline.includes(field))
{
    console.error(`"${field}" is already a real field on ${domain}. Pick one `
        +'the site does not return, or the break will not be a break.');
    process.exit(1);
}

console.log(`Telling the watcher to expect "${field}" from ${domain}.`);
console.log(`Baseline was: ${entry.schema_baseline.join(', ')}`);

save_registry({
    ...before,
    [domain]: {
        ...entry,
        schema_baseline: [...entry.schema_baseline, field].sort(),
    },
});

console.log('\nRunning the loop. Detection, repair and verification from here '
    +'are all real:\n');

const result = await ensure(token, entry.source_url, entry.description);
for (const line of result.trace)
    console.log(`  ${line}`);

// Annotate the heal this produced, if it produced one. Done after the fact
// because ensure() owns the registry while it runs.
const after = load_registry();
const healed = after[domain];
const history = healed?.heal_history ?? [];

if (history.length > (entry.heal_history?.length ?? 0))
{
    save_registry({
        ...after,
        [domain]: {
            ...healed,
            heal_history: history.map((event, i)=>i == history.length-1
                ? {...event, induced: true, induced_field: field}
                : event),
        },
    });
    console.log(`\nMarked the repair as induced (field "${field}").`);
}
else
    console.log('\nNo repair was recorded - the run did not trip the check.');

process.exit(result.health.healthy ? 0 : 1);
