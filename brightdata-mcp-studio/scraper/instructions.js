// What the connecting agent is told about this server, once, at handshake.
//
// It arrives in the `initialize` response and clients put it in the model's
// system prompt, so it is in context for the whole session whether or not the
// user asks for help. That is the point: an agent that installs this from npm
// never sees CLAUDE.md, and everything below is a rule that was learned by
// something going wrong.
//
// Keep it short. It costs context on every session, so it is a decision
// procedure, not a manual - which tool for which request, plus only the facts
// that change what a correct agent would do.

const instructions = `Bright Data MCP Studio builds and maintains custom
scrapers for pages that have no prebuilt scraper, and repairs them when the
site changes underneath them.

START HERE
scraper_ensure is the entry point for almost every request. One call does the
whole loop: reuse an existing scraper or build one, run it, check whether the
data is actually good, repair it if not, re-run to verify the repair, and
escalate once if that fails.

Do not hand-chain scraper_create -> scraper_run -> scraper_heal. Those exist
for when the user asks for a single step on purpose. Reaching for them by
default reimplements scraper_ensure badly and skips the verification step.

CHOOSING A TOOL
  "collect X from site Y"        -> scraper_ensure
  "what scrapers do I have"      -> scraper_registry_list
  "is it built yet"              -> scraper_status
  "picture of the page"          -> scrape_screenshot
  "title / description / og"     -> scrape_metadata
  "how much credit is left"      -> budget_status

FACTS THAT CHANGE WHAT YOU SHOULD DO
1. Building a scraper takes 5-10 minutes. scraper_create returns a
   collector_id immediately, but the scraper is not ready. Poll
   scraper_status. A create call that has not finished is not a hang, and
   calling create again makes a second scraper, not a faster one.

2. AI jobs cannot run in parallel. Bright Data returns 429. Never fan out
   ensure or create calls across several domains at once - do them one at a
   time, and say that is why it is slow.

3. A repair reports success when its AI job finishes, not when the data is
   correct. A repair that fixed nothing looks identical to one that worked
   until you run the scraper again. scraper_ensure re-runs automatically;
   if you called scraper_heal yourself, you must re-run and re-check.

4. Status pending_answer means it is waiting for YOUR approval, not that it
   is still working. Call scraper_approve. Nothing progresses until you do.

5. A failed crawl arrives as data, not as an error - records containing
   error and error_code fields. That is a failure, and no rewrite of a
   scraper fixes a suspended account, an expired plan or a blocked target.
   Report it instead of healing.

6. Escalation rebuilds the scraper from scratch, is capped at one attempt,
   and leaves the previous collector behind. Never loop heal to force a fix.

7. There is one scraper per domain. Asking a domain that already has a
   scraper for something different will be read as that scraper being
   broken, and may get it rewritten. If the user wants other data from a
   site that is already covered, tell them rather than forcing the call.

WRITING A GOOD DESCRIPTION
The description is what the AI builds against, so name the fields.
  weak:   "get the data from this page"
  strong: "top stories: title, points, author, comment count"

PUBLIC DATA ONLY
No login-walled pages, no paywalled content, no personal data.`;

export default instructions;
