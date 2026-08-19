'use strict';
// Dashboard client. Reads the API, renders what actually happened.
//
// Scraped page content is untrusted - a title on a target site is written by
// someone else. Every value from the registry is placed with textContent, so
// nothing scraped is ever parsed as markup.

const REPO = 'https://github.com/Dinesh210805/brightdata-mcp-studio';

const $ = sel=>document.querySelector(sel);

const get_json = async path=>{
    const res = await fetch(path);
    if (!res.ok)
        throw new Error(`${path} returned ${res.status}`);
    return res.json();
};

const el = (tag, cls, text)=>{
    const node = document.createElement(tag);
    if (cls)
        node.className = cls;
    if (text != null)
        node.textContent = text;
    return node;
};

// Dates are shown as "how long ago" because the only question a reader has is
// whether this is still running, not what o'clock it was.
const ago = iso=>{
    if (!iso)
        return 'never';
    const mins = Math.floor((Date.now()-new Date(iso).getTime())/60000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins/60);
    if (hours < 24)
        return `${hours}h ago`;
    return `${Math.floor(hours/24)}d ago`;
};

const on_date = iso=>iso
    ? new Date(iso).toLocaleDateString(undefined,
        {month: 'short', day: 'numeric'})
    : '—';

const stamp = iso=>iso ? new Date(iso).toISOString().replace('T', ' ')
    .slice(0, 16) : '—';

/* ── hero: one real record ───────────────────────────────────────────── */

const value_class = value=>{
    if (typeof value == 'number')
        return 'field-val is-num';
    if (typeof value == 'string' && /^https?:\/\//.test(value))
        return 'field-val is-url';
    return 'field-val';
};

const render_record = (mount, record)=>{
    mount.replaceChildren();
    const entries = Object.entries(record);
    if (!entries.length)
    {
        mount.append(el('p', 'empty', 'No sample recorded yet.'));
        return;
    }
    for (const [key, value] of entries)
    {
        const row = el('div', 'field');
        row.append(el('span', 'field-key', key));
        row.append(el('span', value_class(value),
            value == null ? '—' : String(value)));
        mount.append(row);
    }
};

const render_schema = fields=>{
    const box = $('[data-schema]');
    const list = $('[data-chips]');
    if (!fields.length)
        return;
    list.replaceChildren(...fields.map(f=>el('li', null, f)));
    box.hidden = false;
};

/* ── registry ────────────────────────────────────────────────────────── */

const state_pill = row=>{
    if (row.status == 'abandoned')
        return el('span', 'pill is-off', 'abandoned');
    if (row.heal_count)
        return el('span', 'pill is-warn', `repaired ${row.heal_count}×`);
    return el('span', 'pill is-good', 'healthy');
};

// Rows expand in place. Fetching the sample only when a row is opened keeps
// the first paint small - samples are by far the biggest thing in the file.
const attach_expander = (tbody, tr, row)=>{
    const holder = el('tr', 'row-sample');
    const cell = el('td');
    cell.colSpan = 5;
    holder.append(cell);
    holder.hidden = true;
    tbody.insertBefore(holder, tr.nextSibling);

    let loaded = false;
    tr.addEventListener('click', async ()=>{
        holder.hidden = !holder.hidden;
        if (loaded || holder.hidden)
            return;
        loaded = true;
        const wrap = el('div', 'sample-wrap');
        wrap.append(el('p', 'sample-head',
            `Last sample from ${row.domain} — ${row.description}`));
        try {
            const sample = await get_json(`/api/sample/${row.domain}`);
            wrap.append(el('pre', 'sample-json',
                JSON.stringify(sample, null, 2)));
        } catch(e){
            wrap.append(el('p', 'empty', 'Could not load the sample.'));
        }
        cell.replaceChildren(wrap);
    });
};

const render_registry = rows=>{
    const tbody = $('[data-registry-body]');
    tbody.replaceChildren();

    if (!rows.length)
    {
        const tr = el('tr');
        const td = el('td', 'empty', 'No scrapers yet.');
        td.colSpan = 5;
        tr.append(td);
        tbody.append(tr);
        return;
    }

    for (const row of rows)
    {
        const tr = el('tr', 'row-main');
        tr.append(el('td', null, row.domain));
        tr.append(el('td', 'cid', row.collector_id));
        tr.append(el('td', 'when', ago(row.last_run_at)));
        tr.append(el('td', 'num', row.last_row_count ?? '—'));

        const state = el('td');
        state.append(state_pill(row));
        tr.append(state);

        tbody.append(tr);
        attach_expander(tbody, tr, row);
    }
};

/* ── repair log ──────────────────────────────────────────────────────── */

const heal_pill = event=>{
    if (event.escalated || event.status == 'escalated')
        return el('span', 'pill is-warn', 'rebuilt from scratch');
    if (event.status == 'resolved')
        return el('span', 'pill is-good', 'repaired and verified');
    return el('span', 'pill is-warn', event.status || 'failed');
};

const render_heals = events=>{
    const mount = $('[data-heals]');
    mount.replaceChildren();

    if (!events.length)
    {
        const box = el('div', 'quiet');
        box.append(el('strong', null, 'Nothing has broken yet.'));
        box.append(el('p', null,
            'Repairs are recorded here the moment a run comes back with '
            +'missing or empty fields. An empty log means every scheduled run '
            +'so far has returned the data it was supposed to.'));
        mount.append(box);
        return;
    }

    const list = el('div', 'heal-list');
    for (const event of events)
    {
        const item = el('div', 'heal');
        item.append(el('div', 'heal-when', stamp(event.timestamp)));

        const body = el('div');
        const head = el('div', 'heal-head');
        head.append(el('span', 'heal-domain', event.domain));
        head.append(heal_pill(event));
        body.append(head);

        if (event.prompt)
            body.append(el('p', 'heal-prompt', event.prompt));

        const meta = [
            event.auto_triggered ? 'started on its own' : 'started by hand',
            event.replaced_by ? `replaced by ${event.replaced_by}` : null,
        ].filter(Boolean).join(' · ');
        body.append(el('p', 'heal-meta', meta));

        item.append(body);
        list.append(item);
    }
    mount.append(list);
};

/* ── stats + live state ──────────────────────────────────────────────── */

const render_stats = stats=>{
    $('[data-stat="scrapers"]').textContent = stats.scrapers;
    $('[data-stat="rows"]').textContent = stats.rows.toLocaleString();
    $('[data-stat="heals"]').textContent = stats.heals;

    const since = $('[data-stat="since"]');
    since.textContent = on_date(stats.watching_since);
    since.classList.add('is-date');
};

const render_live = (stats, rows)=>{
    const box = $('[data-live]');
    const text = $('[data-live-text]');
    const broken = rows.some(r=>r.status == 'abandoned');

    if (!rows.length)
    {
        box.dataset.state = 'offline';
        text.textContent = 'No scrapers registered yet';
        return;
    }

    box.dataset.state = broken ? 'broken' : 'healthy';
    const noun = stats.scrapers == 1 ? 'scraper' : 'scrapers';
    text.textContent = `${stats.scrapers} ${noun} · last run `
        +`${ago(stats.last_run_at)}`;
};

/* ── page ────────────────────────────────────────────────────────────── */

const reveal = ()=>{
    const targets = document.querySelectorAll('main > section');
    if (!('IntersectionObserver' in window))
        return;
    const io = new IntersectionObserver(entries=>{
        for (const entry of entries)
        {
            if (!entry.isIntersecting)
                continue;
            entry.target.classList.add('in');
            io.unobserve(entry.target);
        }
    }, {rootMargin: '0px 0px -8%'});

    // The hero is above the fold on load, so revealing it would flash.
    [...targets].slice(1).forEach(node=>{
        node.classList.add('reveal');
        io.observe(node);
    });
};

const wire_copy = ()=>{
    const button = $('[data-copy]');
    button.addEventListener('click', async ()=>{
        try {
            await navigator.clipboard.writeText($('[data-config]').textContent);
            button.textContent = 'Copied';
            button.dataset.copied = '1';
            setTimeout(()=>{
                button.textContent = 'Copy';
                delete button.dataset.copied;
            }, 1800);
        } catch(e){
            button.textContent = 'Press ⌘C';
        }
    });
};

const load = async ()=>{
    $('[data-runs-link]').href = `${REPO}/actions/workflows/scrape.yml`;

    const [stats, rows, heals] = await Promise.all([
        get_json('/api/stats'),
        get_json('/api/registry'),
        get_json('/api/heals'),
    ]);

    render_stats(stats);
    render_live(stats, rows);
    render_registry(rows);
    render_heals(heals);

    // The hero record comes from whichever scraper ran most recently.
    const newest = [...rows]
        .filter(r=>r.last_run_at)
        .sort((a, b)=>b.last_run_at.localeCompare(a.last_run_at))[0];

    const mount = $('[data-record]');
    if (!newest)
    {
        mount.replaceChildren(el('p', 'empty', 'No runs recorded yet.'));
        return;
    }

    render_schema(newest.schema_baseline);
    const sample = await get_json(`/api/sample/${newest.domain}`);
    if (sample.length)
        render_record(mount, sample[0]);
    else
        mount.replaceChildren(el('p', 'empty', 'No sample recorded yet.'));
};

wire_copy();
reveal();
load().catch(e=>{
    const box = $('[data-live]');
    box.dataset.state = 'offline';
    $('[data-live-text]').textContent = 'Dashboard API unreachable';
    $('[data-record]').replaceChildren(
        el('p', 'empty', 'Could not reach the dashboard API.'));
});
