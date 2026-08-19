'use strict'; /*jslint node:true es9:true*/
// Tools the Bright Data CLI has and their MCP server does not: account
// visibility, and two scrape output formats.
//
// Every endpoint here was confirmed against the live API before being written.
// One planned tool did not survive that check - see the note at the bottom of
// the file.
import {z} from 'zod';
import axios from 'axios';
import {imageContent as image_content, UserError} from 'fastmcp';

const BASE_URL = 'https://api.brightdata.com';

const api_token = process.env.API_TOKEN;
const unlocker_zone = process.env.WEB_UNLOCKER_ZONE || 'mcp_unlocker';

const json = value=>JSON.stringify(value, null, 2);

const auth_headers = {authorization: `Bearer ${api_token}`};

const get = async path=>{
    const res = await axios.get(`${BASE_URL}${path}`, {headers: auth_headers});
    return res.data;
};

const scrape_request = (data, response_type = 'text')=>axios({
    url: `${BASE_URL}/request`,
    method: 'POST',
    data: {zone: unlocker_zone, ...data},
    headers: {...auth_headers, 'content-type': 'application/json'},
    responseType: response_type,
});

const zones_list = {
    name: 'zones_list',
    description: 'List the proxy zones on this Bright Data account, with the '
        +'type of each one. Zones are the account-level resources that '
        +'scraping and browser requests are billed against.',
    annotations: {
        title: 'List Zones',
        readOnlyHint: true,
        openWorldHint: false,
    },
    parameters: z.object({}),
    execute: async ()=>{
        const zones = await get('/zone/get_active_zones');
        return json({
            count: zones?.length ?? 0,
            active_unlocker_zone: unlocker_zone,
            zones,
        });
    },
};

// The cost endpoint reports overlapping windows - the last three months AND
// the last three days - so adding them all together counts recent usage twice.
// Each window is reported on its own instead.
const zone_cost_summary = cost_response=>{
    let this_month = 0;
    let today = 0;
    for (const periods of Object.values(cost_response || {}))
    {
        this_month += periods?.back_m0?.cost || 0;
        today += periods?.back_d0?.cost || 0;
    }
    return {this_month, today};
};

const budget_status = {
    name: 'budget_status',
    description: 'Show the Bright Data account balance and what each zone has '
        +'cost so far. Use this to check there is credit left before starting '
        +'work that consumes it, such as building a scraper or running a '
        +'large scrape.',
    annotations: {
        title: 'Account Balance and Spend',
        readOnlyHint: true,
        openWorldHint: false,
    },
    parameters: z.object({}),
    execute: async ()=>{
        const balance = await get('/customer/balance');
        const zones = await get('/zone/get_active_zones');

        // Zones are queried one at a time because the API has no bulk cost
        // endpoint. There are only a handful of zones per account.
        const spend = [];
        for (const zone of zones || [])
        {
            if (!zone?.name)
                continue;
            const cost = await get(
                `/zone/cost?zone=${encodeURIComponent(zone.name)}`);
            const {this_month, today} = zone_cost_summary(cost);
            spend.push({zone: zone.name, cost_this_month: this_month,
                cost_today: today});
        }

        return json({
            balance_usd: balance?.balance ?? 0,
            credit_usd: balance?.credit ?? 0,
            pending_costs_usd: balance?.pending_costs ?? 0,
            spend_by_zone: spend,
        });
    },
};

const scrape_screenshot = {
    name: 'scrape_screenshot',
    description: 'Capture a page as a PNG image, going through Bright Data\'s '
        +'unlocker so it works on sites with bot detection. Use this when you '
        +'need to see how a page looks rather than read its text - checking a '
        +'layout, confirming a page rendered, or inspecting something the '
        +'markdown version loses.',
    annotations: {
        title: 'Screenshot Page',
        readOnlyHint: true,
        openWorldHint: true,
    },
    parameters: z.object({
        url: z.string().url().describe('The page to capture'),
        country: z.string().length(2).optional()
            .describe('2-letter country code to load the page from '
                +'(e.g. "us", "de")'),
    }),
    execute: async ({url, country})=>{
        try {
            const res = await scrape_request(
                {url, format: 'raw', data_format: 'screenshot',
                    ...(country ? {country} : {})},
                'arraybuffer');
            return image_content({buffer: Buffer.from(res.data)});
        } catch(e){
            throw new UserError(`Could not screenshot ${url}: ${e.message}`);
        }
    },
};

const scrape_metadata = {
    name: 'scrape_metadata',
    description: 'Fetch a page and return its HTTP status code, response '
        +'headers and body as structured JSON, rather than converted text. '
        +'Use this to inspect what a server actually returned - checking for '
        +'redirects, content type, caching headers, or whether a page is '
        +'reachable at all.',
    annotations: {
        title: 'Scrape Page Metadata',
        readOnlyHint: true,
        openWorldHint: true,
    },
    parameters: z.object({
        url: z.string().url().describe('The page to fetch'),
        country: z.string().length(2).optional()
            .describe('2-letter country code to load the page from'),
        include_body: z.boolean().optional().default(false)
            .describe('Include the full response body. Off by default - '
                +'bodies are large and scrape_as_markdown is usually the '
                +'better way to read page content.'),
    }),
    execute: async ({url, country, include_body})=>{
        // format:'json' returns an envelope, so the response must be parsed
        // as JSON. Left as text it arrives as a string and every field below
        // reads back undefined without raising anything.
        const res = await scrape_request({url, format: 'json',
            ...(country ? {country} : {})}, 'json');
        const {status_code, headers, body} = res.data || {};
        return json({
            url,
            status_code,
            headers,
            body_length: typeof body == 'string' ? body.length : null,
            ...(include_body ? {body} : {}),
        });
    },
};

// Not included: an async scrape tool. The CLI offers `scrape --async`, but
// POST /request rejects the flag outright ("async" is not allowed), so there
// is no async submit and no way to redeem a job id. Left out rather than
// shipped broken.
export const tools = [
    zones_list,
    budget_status,
    scrape_screenshot,
    scrape_metadata,
];
