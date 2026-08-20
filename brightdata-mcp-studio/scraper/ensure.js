'use strict'; /*jslint node:true es9:true*/
// One call that gets an agent usable data from any public page, and keeps
// working when the site changes underneath it.
//
//   look up the site in the registry
//     known?   reuse the scraper we already built
//     unknown? build one (5-10 minutes, once per site, ever)
//   run it
//   check the data
//     fine?    return it
//     broken?  describe the problem, heal, RUN AGAIN to confirm the fix
//     still broken? throw the scraper away and build a fresh one, once
//
// The re-run after healing is the part that matters. Bright Data's heal
// reports success when its AI job finishes, not when the data is correct - so
// without running again we would happily report a repair that fixed nothing.
//
// Escalation is capped at one attempt. Each rebuild abandons and then deletes
// the broken collector - deletion is irreversible, so a loop here would not
// just burn credits, it would destroy scrapers.
import * as api from './api.js';
import {
    load_registry, save_registry, get_entry, put_entry, record_heal,
    record_run, record_cleanup, abandon,
    domain_of,
} from './registry.js';
import {check_health} from './health.js';
import {save_run} from './store.js';
import {classify_status} from './requests.js';

// AI builds normally take 5-10 minutes. 15 gives slow ones room without
// hanging a caller forever.
const AI_JOB_TIMEOUT_SECONDS = 900;

// Creates a collector and waits for the AI to finish generating it. This is
// the slow path - callers who cannot block should use api.create_collector and
// api.start_ai_build directly, then poll progress themselves.
export const create_and_wait = async (token, url, description, opts = {})=>{
    const name = opts.name
        || `studio-${domain_of(url).replace(/\./g, '-')}-${Date.now()}`;
    const {collector_id} = await api.create_collector(token, {name});
    await api.start_ai_build(token, collector_id, {url, description});
    const {outcome} = await api.poll_until({
        timeout_seconds: opts.timeout_seconds || AI_JOB_TIMEOUT_SECONDS,
        fetch_once: ()=>api.get_build_progress(token, collector_id),
        classify: classify_status,
        on_tick: opts.on_progress,
    });
    if (outcome != 'done')
        throw new Error(`Scraper generation ${outcome} for ${collector_id}`);
    return {collector_id, name};
};

// Runs a heal through to completion, answering the approval gate on the way if
// one appears. Does NOT check whether the fix worked - the caller must run the
// scraper again for that.
export const heal_and_save = async (token, collector_id, prompt)=>{
    await api.start_heal(token, collector_id, prompt);

    const poll = ()=>api.poll_until({
        timeout_seconds: AI_JOB_TIMEOUT_SECONDS,
        fetch_once: ()=>api.get_heal_progress(token, collector_id),
        classify: classify_status,
    });

    const {outcome} = await poll();

    // The flow pauses for a human to accept or reject the proposed fix. We
    // accept, and ask for it to be saved - approving without saving leaves the
    // scraper unchanged, which looks like success and is not.
    if (outcome == 'awaiting')
    {
        await api.resume_job(token, collector_id,
            {approve: true, auto_save: true});
        const resumed = await poll();
        if (resumed.outcome != 'done')
            throw new Error(`Heal ${resumed.outcome} after approval`);
        return;
    }

    if (outcome != 'done')
        throw new Error(`Heal ${outcome} for ${collector_id}`);
};

// Turns health findings into an instruction the repair AI can act on. The
// reasons already name the specific fields, which is why check_health writes
// them for a human reader.
const build_heal_prompt = reasons=>
    `The scraper is returning bad data. Problems found: ${reasons.join('; ')}. `
    +'The page layout has most likely changed and the selectors need updating.';

// Every run gets a history point, including the ones that came back wrong.
// The baseline fields below are updated only on a good run, on purpose - so
// without this the break itself would leave no trace anywhere.
const note_run = (registry, url, records, health)=>record_run(registry, url, {
    rows: records?.length ?? 0,
    healthy: health.healthy,
    fields: health.schema,
});

// Swappable so tests can drive the loop without network or disk access.
const default_deps = {
    load: load_registry,
    save: save_registry,
    run: api.run_collector,
    create: create_and_wait,
    heal: heal_and_save,
    remove: api.delete_collector,
    store: save_run,
};

const new_entry = (built, url, description)=>({
    collector_id: built.collector_id,
    name: built.name,
    source_url: url,
    description,
    created_at: new Date().toISOString(),
    status: 'active',
    schema_baseline: null,
    last_sample: null,
    heal_history: [],
    run_history: [],
});

export const ensure = async (token, url, description, opts = {})=>{
    const deps = {...default_deps, ...opts.deps};
    const auto_heal = opts.auto_heal !== false;
    const trace = [];

    let registry = deps.load();
    let entry = get_entry(registry, url);
    let created = false;

    // An abandoned entry means a previous rebuild gave up on that collector,
    // so treat it the same as never having had one.
    if (!entry || entry.status == 'abandoned')
    {
        trace.push(`No scraper for ${domain_of(url)} yet - building one `
            +'(this takes 5-10 minutes)');
        entry = new_entry(await deps.create(token, url, description, opts),
            url, description);
        registry = put_entry(registry, url, entry);
        created = true;
        trace.push(`Built ${entry.collector_id}`);
    }
    else
    {
        if (entry.description !== description)
        {
            throw new Error(`There is already a scraper for ${domain_of(url)}, built for "${entry.description}". You asked for "${description}". Create a second scraper, or repeat the original description to reuse this one.`);
        }
        trace.push(`Found an existing scraper - reusing ${entry.collector_id}`);
    }

    let records = await deps.run(token, entry.collector_id, url);
    let health = check_health(records, entry.schema_baseline);
    registry = note_run(registry, url, records, health);
    trace.push(`Ran it: ${records?.length ?? 0} rows`);

    let healed = false;
    let escalated = false;

    // A fatal result is an account or target problem, not a scraper problem.
    // Rewriting the scraper cannot fix it, and trying would burn an AI job,
    // fail, and escalate - deleting a collector that was never the problem.
    if (health.fatal)
        trace.push(`Not repairable: ${health.reasons.join('; ')}`);
    else if (!health.healthy && auto_heal)
    {
        healed = true;
        const prompt = build_heal_prompt(health.reasons);
        trace.push(`Data looks wrong: ${health.reasons.join('; ')}`);
        trace.push('Asking Bright Data to repair the scraper');

        try {
            await deps.heal(token, entry.collector_id, prompt);
            records = await deps.run(token, entry.collector_id, url);
            health = check_health(records, entry.schema_baseline);
            registry = note_run(registry, url, records, health);
            trace.push(health.healthy
                ? 'Repaired and verified - data looks right again'
                : `Still wrong after repair: ${health.reasons.join('; ')}`);
        } catch(e){
            trace.push(`Repair failed: ${e.message}`);
        }

        registry = record_heal(registry, url, {
            prompt,
            status: health.healthy ? 'resolved' : 'failed',
        });

        if (!health.healthy)
        {
            escalated = true;
            const abandoned_id = entry.collector_id;
            trace.push('Repair did not work - rebuilding the scraper from '
                +'scratch');

            registry = abandon(registry, url);
            // The replacement inherits both histories. Losing the repair log
            // would erase the record of why the rebuild happened, and losing
            // the run log would cut the graph exactly at the break - which is
            // the part worth looking at.
            const {heal_history, run_history, cleanups} = get_entry(registry, url);
            entry = {
                ...new_entry(await deps.create(token, url, description, opts),
                    url, description),
                heal_history,
                run_history,
                cleanups,
            };
            registry = put_entry(registry, url, entry);
            registry = record_heal(registry, url, {
                prompt: `Rebuilt after ${abandoned_id} could not be repaired`,
                status: 'escalated',
                escalated: true,
                replaced_by: entry.collector_id,
            });

            // The abandoned collector is ours - this flow created or repaired
            // it - so deleting it is safe and keeps the account from filling
            // with dead scrapers. Deletion is irreversible, so the cleanup is
            // recorded in the registry even after the API forgets the ID.
            let orphan_deleted = false;
            let delete_error = null;
            try {
                await deps.remove(token, abandoned_id);
                orphan_deleted = true;
            } catch(e){
                delete_error = e.message;
            }
            registry = record_cleanup(registry, url, {
                collector_id: abandoned_id,
                deleted: orphan_deleted,
                error: delete_error,
            });
            trace.push(orphan_deleted
                ? `Deleted the abandoned scraper ${abandoned_id}`
                : `Could not delete the abandoned scraper ${abandoned_id}: `
                    +delete_error);

            records = await deps.run(token, entry.collector_id, url);
            health = check_health(records, null);
            registry = note_run(registry, url, records, health);
            trace.push(`Rebuilt as ${entry.collector_id}: `
                +(health.healthy ? 'working' : health.reasons.join('; ')));
        }
    }
    else if (!health.healthy)
        trace.push(`Data looks wrong: ${health.reasons.join('; ')}`);

    // Only a good run updates the baseline. Recording the shape of broken data
    // would teach the health check that broken is normal.
    if (health.healthy)
    {
        registry = put_entry(registry, url, {
            ...get_entry(registry, url),
            schema_baseline: health.schema,
            last_sample: records.slice(0, 3),
            last_run_at: new Date().toISOString(),
            last_row_count: records.length,
        });
        // Only good runs are kept. A consumer reading latest.json should never
        // have to ask whether the data in it was any good.
        const written = deps.store(url, records);
        if (written)
            trace.push(`Kept ${written.rows} rows in ${written.archive}`);
    }

    deps.save(registry);

    return {
        domain: domain_of(url),
        collector_id: get_entry(registry, url).collector_id,
        created,
        healed,
        escalated,
        health,
        records,
        trace,
    };
};
