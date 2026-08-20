'use strict'; /*jslint node:true es9:true*/
// Decides whether a scraper run produced usable data.
//
// The failure this exists to catch is the quiet one. When a site changes its
// layout the scraper does not error - it runs happily and returns the right
// number of rows with the values missing. Nothing downstream notices until
// someone looks at the data by hand.
//
// Two checks, both of which give an answer from a single run:
//
//   Schema drift  - a field we used to extract is no longer there at all.
//   Empty fields  - a field is still there but is blank nearly everywhere.
//
// Row-count anomaly detection is deliberately not here. It needs a baseline of
// many runs to mean anything, and before that it either says nothing or fires
// on a site that legitimately had a quiet day.

// Scraper Studio echoes the trigger input back on every record. It is constant
// by definition, so it can never drift and would only dilute the empty-field
// ratio.
const IGNORED_FIELDS = ['input'];

// A field has to be blank in almost every record to count as broken. Real
// pages have genuine gaps - an out-of-stock item with no price, a post with no
// score - and those should not trigger a repair.
const EMPTY_RATIO_THRESHOLD = 0.9;

const is_empty = value=>value == null || value === ''
    || Array.isArray(value) && value.length == 0;

// Bright Data reports a failed crawl as a record describing the failure rather
// than as an HTTP error, so it arrives here looking like data.
//
// Left alone it reads as a perfectly healthy run whose fields happen to be
// `error` and `error_code` - and on a first run those become the baseline, so
// the scraper is then "healthy" forever while returning nothing but the error.
// This is not hypothetical: an account suspension mid-seed did exactly that to
// two scrapers.
//
// It is reported fatal rather than merely unhealthy because no rewrite of a
// scraper can fix a suspended account, an expired plan or a blocked target.
// Healing one would burn an AI job, fail, escalate, and permanently orphan a
// collector - Bright Data has no delete API.
const ERROR_FIELDS = ['error', 'error_code'];

const is_error_envelope = records=>Array.isArray(records) && records.length > 0
    && records.every(record=>record && typeof record == 'object'
        && ERROR_FIELDS.some(field=>field in record)
        && Object.keys(record).every(key=>
            ERROR_FIELDS.includes(key) || IGNORED_FIELDS.includes(key)));

// The set of fields a run actually produced, sorted so two runs can be
// compared directly.
export const schema_of = records=>{
    const fields = new Set();
    // A failed run can answer with an error object rather than an array, so
    // this must not assume it was handed a list.
    if (!Array.isArray(records))
        return [];
    for (const record of records)
    {
        for (const key of Object.keys(record || {}))
        {
            if (!IGNORED_FIELDS.includes(key))
                fields.add(key);
        }
    }
    return [...fields].sort();
};

// Returns {healthy, reasons, schema}. `reasons` is written to be readable by a
// person and is fed straight into the heal prompt, so it names the specific
// fields rather than saying "validation failed".
//
// Pass baseline = null for a first run: there is nothing to compare against,
// so the returned schema becomes the baseline for next time.
export const check_health = (records, baseline)=>{
    const schema = schema_of(records);

    if (!Array.isArray(records) || records.length == 0)
        return {healthy: false, reasons: ['Run returned no records'], schema};

    // Checked before anything else, and with an empty schema, so a crawler
    // error can never be mistaken for data or written back as a baseline.
    if (is_error_envelope(records))
    {
        const {error, error_code} = records[0];
        return {healthy: false, fatal: true, schema: [],
            reasons: [`Bright Data could not crawl the page: `
                +`${error || error_code}`]};
    }

    // A field that is empty in every record never appears in the schema at
    // all, so with no baseline the loop below would have nothing to look at
    // and rows of {} would pass. This is exactly what a failed rebuild
    // produces, so it is checked first.
    if (schema.length == 0)
    {
        return {healthy: false, schema,
            reasons: ['Records contain no extracted fields']};
    }

    const reasons = [];

    // Only fields that vanished matter. New fields appearing is a site adding
    // something, not a scraper breaking.
    const missing = (baseline || []).filter(field=>!schema.includes(field));
    if (missing.length)
        reasons.push(`Schema drift: missing ${missing.join(', ')}`);

    // Check the baseline fields when we have one, so a scraper that lost a
    // field is judged on what it used to produce rather than what is left.
    const fields_to_check = baseline?.length ? baseline : schema;
    for (const field of fields_to_check)
    {
        const empty_count = records.filter(r=>is_empty(r?.[field])).length;
        const ratio = empty_count/records.length;
        if (ratio >= EMPTY_RATIO_THRESHOLD)
        {
            reasons.push(`Field "${field}" is empty in `
                +`${Math.round(ratio*100)}% of records`);
        }
    }

    return {healthy: reasons.length == 0, reasons, schema};
};
