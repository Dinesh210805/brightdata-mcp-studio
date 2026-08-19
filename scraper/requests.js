'use strict'; /*jslint node:true es9:true*/
// Pure helpers for the Scraper Studio (DCA) API: request bodies in, status
// strings out. Nothing here touches the network, which is what makes the
// awkward parts - the payload shapes and the status vocabulary - testable on
// their own.
//
// Shapes are ported from the Bright Data CLI, which is the reference
// implementation for these endpoints:
//   reference/brightdata-cli/src/commands/scraper.ts

// Statuses the AI-Flow progress endpoints can return.
export const DONE_STATUS = 'done';
// The self-healing flow pauses here and waits for a human to approve or reject
// the proposed fix. It is not a failure and not a success.
export const AWAITING_STATUS = 'pending_answer';
export const TERMINAL_FAIL_STATUSES = ['failed', 'error', 'cancelled'];

// Every collector must declare where finished data is delivered. We poll for
// results instead, so this is a placeholder that satisfies the API. Callers
// who genuinely want a webhook can pass their own.
const STUB_DELIVERY_WEBHOOK = 'https://example.com/webhook';

export const build_collector_request = ({name, deliver_webhook})=>({
    name,
    deliver: {
        type: 'webhook',
        endpoint: deliver_webhook || STUB_DELIVERY_WEBHOOK,
        filename: {template: 'data', extension: 'json'},
    },
});

// Starts the 5-10 minute AI build. `urls` is an array even for one URL,
// because the endpoint accepts several.
export const build_ai_request = (url, description)=>({
    description,
    urls: [url],
});

// Healing reuses the same field name as creation: the prompt describing what
// is broken arrives as `description`.
export const build_heal_request = prompt=>({description: prompt});

// Resumes a job stopped at the approval gate. `auto_save` persists the healed
// template once the job finishes; the API ignores it on a reject, so we leave
// it out there rather than sending a field that does nothing.
export const build_resume_request = (approve, auto_save)=>
    approve && auto_save
        ? {message: true, auto_save: true}
        : {message: approve};

// Collapses the API's status vocabulary into the four outcomes a caller cares
// about. Anything unrecognised - including an empty or missing response - is
// 'running', so a slow or briefly-empty progress endpoint does not abort a
// healthy job.
export const classify_status = progress=>{
    const status = progress?.status;
    if (status == DONE_STATUS)
        return 'done';
    if (status == AWAITING_STATUS)
        return 'awaiting';
    if (TERMINAL_FAIL_STATUSES.includes(status))
        return 'failed';
    return 'running';
};
