'use strict'; /*jslint node:true es9:true*/
// Two moments are worth an email: a site breaks and a repair is starting, and
// the six-hourly cron finishing a pass over everything.
//
// Sent through Resend's REST API because it needs nothing but an API key - no
// SMTP config, no verified sending domain required to get started (their
// shared onboarding address works immediately).
//
// Every alert composer takes an injectable `send`, defaulting to the real
// send_email, so callers and tests never need a real network call or a real
// API key to exercise the logic that decides what an email says.
import axios from 'axios';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || 'onboarding@resend.dev';

// Neither var set is the normal case for anyone who hasn't opted in - a fork
// running the tests, or an account that just hasn't set up alerts yet. This
// is checked before every send so that case never has to be an error.
export const email_configured = ()=>Boolean(RESEND_API_KEY && ALERT_EMAIL_TO);

export const send_email = async ({subject, text})=>{
    if (!email_configured())
    {
        console.error(`[email] RESEND_API_KEY/ALERT_EMAIL_TO not set - `
            +`would have sent: ${subject}`);
        return false;
    }
    try {
        await axios.post('https://api.resend.com/emails', {
            from: ALERT_EMAIL_FROM,
            to: [ALERT_EMAIL_TO],
            subject,
            text,
        }, {
            headers: {authorization: `Bearer ${RESEND_API_KEY}`},
        });
        return true;
    } catch(e){
        // An alert that fails to send should never fail the run it is
        // reporting on - the heal or the cron already finished, and the
        // email is just telling someone about it.
        const detail = e.response?.data?.message || e.message;
        console.error(`[email] failed to send "${subject}": ${detail}`);
        return false;
    }
};

// Fired the moment a repair starts, not when it finishes - "I noticed and I'm
// on it" is the useful signal here, and the registry/dashboard already show
// the outcome once the run completes.
export const notify_break = async (domain, reasons, opts = {})=>{
    const send = opts.send || send_email;
    const fatal = Boolean(opts.fatal);

    if (fatal)
    {
        return send({
            subject: `${domain} is broken and needs your attention`,
            text: `${domain} cannot be automatically repaired:\n\n`
                +reasons.map(r=>`- ${r}`).join('\n')
                +'\n\nThis usually means the account, the target site, or the '
                +'plan has a problem no scraper rewrite can fix. It will keep '
                +'reporting this way until someone looks at it.',
        });
    }

    return send({
        subject: `${domain} changed - healing now`,
        text: `${domain} stopped returning correct data:\n\n`
            +reasons.map(r=>`- ${r}`).join('\n')
            +'\n\nBright Data is repairing the scraper now, and the fix will '
            +'be verified with a second run before anything is trusted. '
            +'You will see the outcome in the registry or the dashboard '
            +'shortly.',
    });
};

// One email per scheduled pass, not one per site - the six-hourly cron on
// its own would otherwise mean an inbox getting several messages at once.
export const notify_digest = async (results, opts = {})=>{
    const send = opts.send || send_email;
    const healthy = results.filter(r=>r.healthy).length;
    const broken = results.length-healthy;

    const lines = results.map(r=>
        `- ${r.domain}: ${r.healthy ? `ok, ${r.rows} rows` : 'STILL BROKEN'}`);

    return send({
        subject: `Scheduled scrape: ${healthy}/${results.length} healthy`
            +(broken ? `, ${broken} broken` : ''),
        text: lines.join('\n'),
    });
};
