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

// Refs come from an ARIA snapshot and are only valid against the page that
// produced them, so every ref tool asks for a description too - it makes the
// error message useful when a ref has gone stale.
const ref_parameters = extra=>z.object({
    ref: z.string()
        .describe('The ref attribute from the ARIA snapshot (e.g. "23")'),
    element: z.string()
        .describe('Description of the element, for context in errors'),
    ...extra,
});

// Every ref action is the same three steps - resolve, act, report - so they
// share one wrapper rather than repeating the try/catch six times.
const ref_tool = ({name, title, description, extra = {}, act, success})=>({
    name,
    description: [description,
        'Use scraping_browser_snapshot first to get the correct ref values.']
        .join('\n'),
    annotations: {title, destructiveHint: true},
    parameters: ref_parameters(extra),
    execute: async args=>{
        const browser_session = await require_browser();
        try {
            const locator = await browser_session.ref_locator({
                element: args.element,
                ref: args.ref,
            });
            await act(locator, args);
            return success(args);
        } catch(e){
            throw new UserError(`Error on ${args.element} `
                +`(ref=${args.ref}): ${e}`);
        }
    },
});

const scraping_browser_select_ref = ref_tool({
    name: 'scraping_browser_select_ref',
    title: 'Browser Select Dropdown Option',
    description: 'Choose an option in a dropdown (select element) by its '
        +'visible label.',
    extra: {
        value: z.string()
            .describe('The visible label of the option to choose'),
    },
    act: (locator, {value})=>locator.selectOption({label: value},
        {timeout: 5000}),
    success: ({value, element})=>`Selected "${value}" in ${element}`,
});

const scraping_browser_check_ref = ref_tool({
    name: 'scraping_browser_check_ref',
    title: 'Browser Check Box',
    description: 'Tick a checkbox or select a radio button. Does nothing if '
        +'it is already ticked.',
    act: locator=>locator.check({timeout: 5000}),
    success: ({element})=>`Checked ${element}`,
});

const scraping_browser_uncheck_ref = ref_tool({
    name: 'scraping_browser_uncheck_ref',
    title: 'Browser Uncheck Box',
    description: 'Untick a checkbox. Does nothing if it is already unticked.',
    act: locator=>locator.uncheck({timeout: 5000}),
    success: ({element})=>`Unchecked ${element}`,
});

const scraping_browser_hover_ref = ref_tool({
    name: 'scraping_browser_hover_ref',
    title: 'Browser Hover Element',
    description: 'Move the mouse over an element. Use this to open hover '
        +'menus or reveal content that only appears on hover, then take a '
        +'new snapshot to see what appeared.',
    act: locator=>locator.hover({timeout: 5000}),
    success: ({element})=>`Hovered over ${element}`,
});

const scraping_browser_reload = {
    name: 'scraping_browser_reload',
    description: 'Reload the current page. Useful after an action that '
        +'changed server-side state, or to retry a page that loaded badly.',
    annotations: {title: 'Browser Reload Page', destructiveHint: true},
    parameters: z.object({
        wait_until: z.enum(['load', 'domcontentloaded', 'networkidle'])
            .optional().default('load')
            .describe('How long to wait: "load" for the load event, '
                +'"domcontentloaded" to return sooner, "networkidle" for '
                +'pages that keep fetching after load'),
    }),
    execute: async ({wait_until})=>{
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

const scraping_browser_cookies = {
    name: 'scraping_browser_cookies',
    description: 'List the cookies the current browser session holds. Use '
        +'this to check whether a site set the session or consent cookies it '
        +'was expected to.',
    annotations: {title: 'Browser Cookies', readOnlyHint: true},
    parameters: z.object({
        name_contains: z.string().optional()
            .describe('Only return cookies whose name contains this text'),
    }),
    execute: async ({name_contains})=>{
        const browser_session = await require_browser();
        try {
            const page = await browser_session.get_page();
            const cookies = await page.context().cookies();
            const filtered = name_contains
                ? cookies.filter(c=>c.name.includes(name_contains))
                : cookies;
            // Values are omitted deliberately: session cookies are
            // credentials, and an agent listing cookies wants to know what
            // exists, not to read the secrets.
            return JSON.stringify({
                count: filtered.length,
                cookies: filtered.map(({name, domain, path, expires,
                    httpOnly, secure, sameSite})=>({name, domain, path,
                    expires, httpOnly, secure, sameSite})),
            }, null, 2);
        } catch(e){
            throw new UserError(`Error reading cookies: ${e}`);
        }
    },
};

const scraping_browser_close_session = {
    name: 'scraping_browser_close_session',
    description: 'Close the browser and end the session. The next browser '
        +'tool call starts a fresh one, so use this to discard cookies and '
        +'page state, or to release the session when finished.',
    annotations: {title: 'Browser Close Session', destructiveHint: true},
    parameters: z.object({}),
    execute: async ()=>{
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
