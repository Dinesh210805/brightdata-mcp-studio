'use strict'; /*jslint node:true es9:true*/
// The Scraper Studio lifecycle as MCP tools.
//
// Bright Data's server ships ~50 ready-made extractors, one per supported
// site. These seven tools cover the case those cannot: a site nobody has built
// an extractor for. The agent describes what it wants in plain English, Bright
// Data's AI writes the scraper, and it keeps working when the site changes.
//
// scraper_ensure is the one an agent should reach for by default. The other
// six exist for callers who want to drive the steps themselves.
import {z} from 'zod';
import * as api from './api.js';
import {ensure, create_and_wait, heal_and_save} from './ensure.js';
import {fast_check} from './fast_check.js';
import {load_registry} from './registry.js';
import {classify_status} from './requests.js';

const api_token = process.env.API_TOKEN;

// A run can return hundreds of records, and every one of them costs the
// calling agent context it may need for something else. Ten is enough to see
// the shape of the data and judge whether it is right; callers that genuinely
// need more can ask.
const DEFAULT_RECORD_LIMIT = 10;
const MAX_RECORD_LIMIT = 200;

const json = value=>JSON.stringify(value, null, 2);

const record_limit_schema = z.number().int().min(1).max(MAX_RECORD_LIMIT)
    .optional().default(DEFAULT_RECORD_LIMIT)
    .describe(`How many records to return (default ${DEFAULT_RECORD_LIMIT}, `
        +`max ${MAX_RECORD_LIMIT}). The full row count is always reported.`);

const truncate_records = (records, limit = DEFAULT_RECORD_LIMIT)=>{
    if (!Array.isArray(records) || records.length <= limit)
        return {records};
    return {
        records: records.slice(0, limit),
        truncated: `Showing ${limit} of ${records.length} records. Ask for a `
            +'higher limit if you need more.',
    };
};

const scraper_ensure = {
    name: 'scraper_ensure',
    description: 'Get structured data from any public page, building a scraper '
        +'for it first if one does not exist yet. This is the tool to reach '
        +'for when no web_data_* tool covers the target site. It reuses an '
        +'existing scraper when there is one, detects when a scraper has '
        +'broken because the site changed, repairs it, and verifies the '
        +'repair by running again. Building a new scraper takes 5-10 minutes; '
        +'reusing one takes seconds.',
    annotations: {
        title: 'Get Data (build or reuse a scraper)',
        readOnlyHint: false,
        openWorldHint: true,
    },
    parameters: z.object({
        url: z.string().url()
            .describe('The public page to extract data from'),
        description: z.string().max(500)
            .describe('What to extract, in plain English. For example: '
                +'"product name, price and availability for each item"'),
        limit: record_limit_schema,
    }),
    execute: async ({url, description, limit})=>{
        const result = await ensure(api_token, url, description);
        return json({
            domain: result.domain,
            collector_id: result.collector_id,
            built_a_new_scraper: result.created,
            repaired: result.healed,
            rebuilt_from_scratch: result.escalated,
            healthy: result.health.healthy,
            problems: result.health.reasons,
            row_count: result.records?.length ?? 0,
            what_happened: result.trace,
            ...truncate_records(result.records, limit),
        });
    },
};

const scraper_create = {
    name: 'scraper_create',
    description: 'Build a new custom scraper for a public page from a plain '
        +'English description, using Bright Data Scraper Studio. Returns a '
        +'collector_id straight away, but the scraper is not usable until '
        +'generation finishes, which takes 5-10 minutes - poll scraper_status '
        +'until it reports "done". Prefer scraper_ensure unless you '
        +'specifically need to manage the scraper yourself.',
    annotations: {
        title: 'Create Scraper',
        readOnlyHint: false,
        openWorldHint: true,
    },
    parameters: z.object({
        url: z.string().url()
            .describe('The public page the scraper should target'),
        description: z.string().max(500)
            .describe('What to extract, in plain English'),
        name: z.string().optional()
            .describe('Optional name for the scraper template'),
    }),
    execute: async ({url, description, name})=>{
        // Deliberately does not wait for the build. Returning the id after a
        // second beats holding the tool call open for ten minutes.
        const {collector_id} = await api.create_collector(api_token,
            {name: name || `studio-${Date.now()}`});
        await api.start_ai_build(api_token, collector_id, {url, description});
        return json({
            collector_id,
            status: 'generating',
            next_step: 'Call scraper_status with this collector_id until it '
                +'reports "done" (usually 5-10 minutes), then scraper_run.',
        });
    },
};

const scraper_status = {
    name: 'scraper_status',
    description: 'Check how far along a scraper build is. Returns "generating" '
        +'while the AI is still working, "done" when the scraper is ready to '
        +'run, or "failed" if generation gave up.',
    annotations: {
        title: 'Scraper Build Status',
        readOnlyHint: true,
        openWorldHint: true,
    },
    parameters: z.object({
        collector_id: z.string()
            .describe('The collector_id returned by scraper_create'),
    }),
    execute: async ({collector_id})=>{
        const progress = await api.get_build_progress(api_token, collector_id);
        const outcome = classify_status(progress);
        return json({
            collector_id,
            status: outcome == 'running' ? 'generating' : outcome,
            current_step: progress?.step ?? null,
            completed_steps: progress?.completed_steps?.length ?? 0,
        });
    },
};

const scraper_run = {
    name: 'scraper_run',
    description: 'Run an existing scraper against a URL and return the '
        +'extracted records. Use the fast path automatically, falling back to '
        +'the batch endpoint for pages too large for it.',
    annotations: {
        title: 'Run Scraper',
        readOnlyHint: true,
        openWorldHint: true,
    },
    parameters: z.object({
        collector_id: z.string()
            .describe('The collector_id of the scraper to run'),
        url: z.string().url().describe('The page to scrape'),
        limit: record_limit_schema,
    }),
    execute: async ({collector_id, url, limit})=>{
        const records = await api.run_collector(api_token, collector_id, url);
        return json({
            collector_id,
            row_count: Array.isArray(records) ? records.length : 0,
            ...truncate_records(records, limit),
        });
    },
};

const scraper_heal = {
    name: 'scraper_heal',
    description: 'Repair a scraper that has stopped returning correct data, '
        +'usually because the site changed its layout. Describe what looks '
        +'wrong and Bright Data\'s AI rewrites the scraper. Note that a '
        +'successful repair means the AI job finished, not that the data is '
        +'correct - run the scraper again afterwards to confirm. '
        +'scraper_ensure does that automatically.',
    annotations: {
        title: 'Repair Scraper',
        readOnlyHint: false,
        openWorldHint: true,
    },
    parameters: z.object({
        collector_id: z.string()
            .describe('The collector_id of the scraper to repair'),
        prompt: z.string().max(1000)
            .describe('What is wrong, in plain English. For example: "the '
                +'price field comes back empty since the page redesign"'),
        auto_approve: z.boolean().optional().default(true)
            .describe('Accept and save the proposed fix automatically. Set '
                +'false to review it yourself with scraper_approve.'),
    }),
    execute: async ({collector_id, prompt, auto_approve})=>{
        if (auto_approve)
        {
            await heal_and_save(api_token, collector_id, prompt);
            return json({
                collector_id,
                status: 'repaired',
                next_step: 'Run the scraper again to confirm the data is '
                    +'correct. A finished repair job does not guarantee it.',
            });
        }

        // Manual mode: start the job and report where it got to, leaving the
        // approval decision to the caller.
        await api.start_heal(api_token, collector_id, prompt);
        const {outcome} = await api.poll_until({
            timeout_seconds: 900,
            fetch_once: ()=>api.get_heal_progress(api_token, collector_id),
            classify: classify_status,
        });
        return json({
            collector_id,
            status: outcome == 'awaiting' ? 'awaiting_approval' : outcome,
            next_step: outcome == 'awaiting'
                ? 'Call scraper_approve to accept the fix, or with reject '
                    +'true to discard it.'
                : 'Run the scraper again to confirm the data is correct.',
        });
    },
};

const scraper_approve = {
    name: 'scraper_approve',
    description: 'Accept or reject a repair that is waiting for approval. '
        +'Accepting also saves the rewritten scraper; rejecting leaves the '
        +'scraper exactly as it was.',
    annotations: {
        title: 'Approve or Reject Repair',
        readOnlyHint: false,
        openWorldHint: true,
    },
    parameters: z.object({
        collector_id: z.string()
            .describe('The collector_id whose repair is awaiting approval'),
        reject: z.boolean().optional().default(false)
            .describe('Set true to discard the proposed fix instead'),
    }),
    execute: async ({collector_id, reject})=>{
        await api.resume_job(api_token, collector_id,
            {approve: !reject, auto_save: !reject});
        return json({
            collector_id,
            decision: reject ? 'rejected' : 'approved_and_saved',
            next_step: reject
                ? 'The scraper is unchanged. Try scraper_heal again with a '
                    +'clearer description of the problem.'
                : 'Run the scraper again to confirm the data is correct.',
        });
    },
};

const scraper_registry_list = {
    name: 'scraper_registry_list',
    description: 'List every custom scraper built through this server: which '
        +'site each one covers, when it was built, when it last ran, and how '
        +'many times it has needed repair. Bright Data can list the collectors '
        +'in your account, but it cannot say which site each one targets - '
        +'this local registry is the only record of that mapping.',
    annotations: {
        title: 'List Scrapers',
        readOnlyHint: true,
        openWorldHint: false,
    },
    parameters: z.object({}),
    execute: async ()=>{
        const registry = load_registry();
        // last_sample is deliberately left out - it is for the dashboard, and
        // returning full records for every scraper would flood the context.
        const scrapers = Object.entries(registry).map(([domain, entry])=>({
            domain,
            collector_id: entry.collector_id,
            status: entry.status,
            description: entry.description,
            created_at: entry.created_at,
            last_run_at: entry.last_run_at ?? null,
            last_row_count: entry.last_row_count ?? null,
            fields: entry.schema_baseline ?? null,
            repair_count: entry.heal_history?.length ?? 0,
        }));
        return json({count: scrapers.length, scrapers});
    },
};

const scraper_check_now = {
    name: 'scraper_check_now',
    description: 'Fast, on-demand check for whether a known scraper is still '
        +'returning good data - a real scrape and a data check, no AI job, so '
        +'it costs a fraction of scraper_ensure. Use this to check a site '
        +'right now instead of waiting for the 6-hourly schedule. If the data '
        +'looks wrong it automatically escalates to a full repair (the same '
        +'thing scraper_ensure does) and reports that outcome too. If another '
        +'check or repair is already running for this domain, it reports '
        +'that instead of starting a second one.',
    annotations: {
        title: 'Check Scraper Health Now',
        readOnlyHint: false,
        openWorldHint: true,
    },
    parameters: z.object({
        url: z.string().url()
            .describe('The page whose scraper should be checked. Must '
                +'already have a scraper - this does not build one.'),
    }),
    execute: async ({url})=>{
        const result = await fast_check(api_token, url);
        if (result.skipped)
        {
            return json({
                url,
                skipped: true,
                reason: result.reason,
                next_step: 'A check or repair for this domain is already in '
                    +'progress. Try again in a few minutes.',
            });
        }
        return json({
            url,
            healthy: result.healthy,
            problems: result.reasons,
            repaired: Boolean(result.escalated_to_heal && result.healed),
            rebuilt_from_scratch: Boolean(result.escalated_to_heal
                && result.escalated),
            what_happened: result.trace ?? (result.healthy
                ? ['Checked - data looks right, no repair needed.']
                : ['No registry entry for this domain yet - nothing to '
                    +'check. Use scraper_ensure to build one.']),
        });
    },
};

export const tools = [
    scraper_ensure,
    scraper_create,
    scraper_status,
    scraper_run,
    scraper_heal,
    scraper_approve,
    scraper_registry_list,
    scraper_check_now,
];
