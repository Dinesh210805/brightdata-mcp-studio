'use strict'; /*jslint node:true es9:true*/
// Browser actions the Bright Data CLI can do and their MCP server cannot:
// dropdowns, checkboxes, hovering, reloading, cookies, and closing a session.
//
// These run on the *same* browser as their existing 14 browser tools, by
// borrowing require_browser from browser_tools.js. That matters: element refs
// come from a snapshot of a specific page, so a tool operating on a different
// browser would be handed refs that mean nothing. Filling these gaps with a
// separate browser - the CLI's daemon, say - would look like it worked and
// then fail in confusing ways.
import {z} from 'zod';
import {UserError} from 'fastmcp';
import {require_browser, close_browser_sessions} from '../browser_tools.js';

const SNAPSHOT_HINT = 'Use scraping_browser_snapshot first to get the correct '
    +'ref values.';

// Refs are only valid against the snapshot that produced them, so every ref
// tool also takes a description - it is what makes the error readable when a
// ref has gone stale.
const ref_schema = z.string()
    .describe('The ref attribute from the ARIA snapshot (e.g. "23")');
const element_schema = z.string()
    .describe('Description of the element, for context in errors');

let scraping_browser_select_ref = {
    name: 'scraping_browser_select_ref',
    description: [
        'Choose an option in a dropdown (select element) by its visible label.',
        SNAPSHOT_HINT,
    ].join('\n'),
    annotations: {
        title: 'Browser Select Dropdown Option',
        destructiveHint: true,
    },
    parameters: z.object({
        ref: ref_schema,
        element: element_schema,
        value: z.string()
            .describe('The visible label of the option to choose'),
    }),
    execute: async({ref, element, value})=>{
        const browser_session = await require_browser();
        try {
            const locator = await browser_session.ref_locator({element, ref});
            await locator.selectOption({label: value}, {timeout: 5000});
            return `Selected "${value}" in ${element} (ref=${ref})`;
        } catch(e){
            throw new UserError(`Error selecting "${value}" in ${element} `
                +`with ref ${ref}: ${e}`);
        }
    },
};

let scraping_browser_check_ref = {
    name: 'scraping_browser_check_ref',
    description: [
        'Tick a checkbox or select a radio button.',
        'Does nothing if it is already ticked.',
        SNAPSHOT_HINT,
    ].join('\n'),
    annotations: {
        title: 'Browser Check Box',
        destructiveHint: true,
    },
    parameters: z.object({ref: ref_schema, element: element_schema}),
    execute: async({ref, element})=>{
        const browser_session = await require_browser();
        try {
            const locator = await browser_session.ref_locator({element, ref});
            await locator.check({timeout: 5000});
            return `Checked ${element} (ref=${ref})`;
        } catch(e){
            throw new UserError(`Error checking ${element} with ref `
                +`${ref}: ${e}`);
        }
    },
};

let scraping_browser_uncheck_ref = {
    name: 'scraping_browser_uncheck_ref',
    description: [
        'Untick a checkbox.',
        'Does nothing if it is already unticked.',
        SNAPSHOT_HINT,
    ].join('\n'),
    annotations: {
        title: 'Browser Uncheck Box',
        destructiveHint: true,
    },
    parameters: z.object({ref: ref_schema, element: element_schema}),
    execute: async({ref, element})=>{
        const browser_session = await require_browser();
        try {
            const locator = await browser_session.ref_locator({element, ref});
            await locator.uncheck({timeout: 5000});
            return `Unchecked ${element} (ref=${ref})`;
        } catch(e){
            throw new UserError(`Error unchecking ${element} with ref `
                +`${ref}: ${e}`);
        }
    },
};

let scraping_browser_hover_ref = {
    name: 'scraping_browser_hover_ref',
    description: [
        'Move the mouse over an element.',
        'Use this to open hover menus or reveal content that only appears on '
            +'hover, then take a new snapshot to see what appeared.',
        SNAPSHOT_HINT,
    ].join('\n'),
    annotations: {
        title: 'Browser Hover Element',
        destructiveHint: true,
    },
    parameters: z.object({ref: ref_schema, element: element_schema}),
    execute: async({ref, element})=>{
        const browser_session = await require_browser();
        try {
            const locator = await browser_session.ref_locator({element, ref});
            await locator.hover({timeout: 5000});
            return `Hovered over ${element} (ref=${ref})`;
        } catch(e){
            throw new UserError(`Error hovering over ${element} with ref `
                +`${ref}: ${e}`);
        }
    },
};

let scraping_browser_reload = {
    name: 'scraping_browser_reload',
    description: [
        'Reload the current page.',
        'Useful after an action that changed server-side state, or to retry '
            +'a page that loaded badly.',
    ].join('\n'),
    annotations: {
        title: 'Browser Reload Page',
        destructiveHint: true,
    },
    parameters: z.object({
        wait_until: z.enum(['load', 'domcontentloaded', 'networkidle'])
            .optional().default('load')
            .describe('How long to wait: "load" for the load event, '
                +'"domcontentloaded" to return sooner, "networkidle" for '
                +'pages that keep fetching after load'),
    }),
    execute: async({wait_until})=>{
        const browser_session = await require_browser();
        try {
            const page = await browser_session.get_page();
            await page.reload({waitUntil: wait_until, timeout: 120000});
            return `Reloaded ${page.url()}`;
        } catch(e){
            throw new UserError(`Error reloading page: ${e}`);
        }
    },
};

let scraping_browser_cookies = {
    name: 'scraping_browser_cookies',
    description: [
        'List the cookies the current browser session holds.',
        'Use this to check whether a site set the session or consent cookies '
            +'it was expected to.',
        'Values are omitted unless include_values is set, since session '
            +'cookies are credentials.',
    ].join('\n'),
    annotations: {
        title: 'Browser Cookies',
        readOnlyHint: true,
    },
    parameters: z.object({
        name_contains: z.string().optional()
            .describe('Only return cookies whose name contains this text'),
        include_values: z.boolean().optional().default(false)
            .describe('Include each cookie\'s value. Off by default: session '
                +'cookies are credentials, and printing them puts them in the '
                +'conversation transcript. Turn it on when you actually need '
                +'to inspect a value.'),
    }),
    execute: async({name_contains, include_values})=>{
        const browser_session = await require_browser();
        try {
            const page = await browser_session.get_page();
            const cookies = await page.context().cookies();
            const filtered = name_contains
                ? cookies.filter(cookie=>cookie.name.includes(name_contains))
                : cookies;
            return JSON.stringify({
                count: filtered.length,
                cookies: filtered.map(cookie=>({
                    name: cookie.name,
                    ...include_values ? {value: cookie.value} : {},
                    domain: cookie.domain,
                    path: cookie.path,
                    expires: cookie.expires,
                    httpOnly: cookie.httpOnly,
                    secure: cookie.secure,
                    sameSite: cookie.sameSite,
                })),
            }, null, 2);
        } catch(e){
            throw new UserError(`Error reading cookies: ${e}`);
        }
    },
};

let scraping_browser_close_session = {
    name: 'scraping_browser_close_session',
    description: [
        'Close the browser and end the session.',
        'The next browser tool call starts a fresh one, so use this to '
            +'discard cookies and page state, or to release the session when '
            +'finished.',
    ].join('\n'),
    annotations: {
        title: 'Browser Close Session',
        destructiveHint: true,
    },
    parameters: z.object({}),
    execute: async()=>{
        const was_open = await close_browser_sessions();
        return was_open
            ? 'Browser session closed. The next browser tool call will start '
                +'a new one.'
            : 'No browser session was open.';
    },
};

export const tools = [
    scraping_browser_select_ref,
    scraping_browser_check_ref,
    scraping_browser_uncheck_ref,
    scraping_browser_hover_ref,
    scraping_browser_reload,
    scraping_browser_cookies,
    scraping_browser_close_session,
];
