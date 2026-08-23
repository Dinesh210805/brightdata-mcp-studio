// The full MCP tool catalog, mirroring tool_groups.js in the server repo.
//
// Descriptions are copied verbatim from assets/Tools.md and server.js so this
// page never says something the tool itself doesn't. `origin: 'ours'` marks
// the fork's additions — the scraper lifecycle and the CLI-parity gaps — so a
// visitor can tell in one glance what upstream Bright Data shipped versus what
// this project built on top of it.

export type ToolOrigin = 'ours' | 'upstream'

export interface Tool {
  name: string
  description: string
  origin: ToolOrigin
}

export interface ToolGroup {
  id: string
  name: string
  description: string
  tools: Tool[]
}

const ours = (name: string, description: string): Tool =>
  ({ name, description, origin: 'ours' })
const up = (name: string, description: string): Tool =>
  ({ name, description, origin: 'upstream' })

const BASE: Tool[] = [
  up('search_engine', 'Scrape search results from Google, Bing, or Yandex. '
    + 'Returns SERP results in JSON for Google and Markdown for Bing/Yandex; '
    + 'supports pagination with the cursor parameter.'),
  up('scrape_as_markdown', 'Scrape a single webpage with advanced extraction '
    + 'and return Markdown. Uses Bright Data’s unlocker to handle bot '
    + 'protection and CAPTCHA.'),
  up('discover', 'Search the web and rank results by AI-driven relevance. '
    + 'Returns scored results with title, description, URL, and relevance '
    + 'score. Supports intent-based ranking, geo-targeting, date filtering, '
    + 'and keyword filtering.'),
]

const SCRAPER_STUDIO_TOOLS: Tool[] = [
  ours('scraper_create', 'Build a brand-new custom scraper for any public '
    + 'page from a natural-language description, using Bright Data Scraper '
    + 'Studio. Returns a collector_id immediately — AI generation takes '
    + '5–10 minutes.'),
  ours('scraper_status', 'Poll build or heal progress for a collector once, '
    + 'returning the current status and step.'),
  ours('scraper_run', 'Run a collector against a URL and return the '
    + 'structured records it collected.'),
  ours('scraper_heal', 'Rewrite a collector’s extraction logic from a '
    + 'plain-language description of what went wrong — which field went '
    + 'empty, what the page looks like now.'),
  ours('scraper_approve', 'Approve or reject a heal or build that is '
    + 'waiting on manual confirmation.'),
  ours('scraper_ensure', 'The full lifecycle in one call: reuse a known '
    + 'scraper or build one, run it, check the data (not just the status '
    + 'code), and if it’s wrong, heal it and verify the fix actually '
    + 'held — escalating to a one-time rebuild if it still doesn’t.'),
  ours('scraper_registry_list', 'List every scraper this account has built '
    + 'through Studio: domain, collector ID, health, and how many times '
    + 'it’s been repaired.'),
]

const ACCOUNT_TOOLS: Tool[] = [
  ours('zones_list', 'List the proxy zones on this Bright Data account, '
    + 'with the type of each one. Zones are the account-level resources '
    + 'that scraping and browser requests are billed against.'),
  ours('budget_status', 'Show the Bright Data account balance and what '
    + 'each zone has cost so far. Use this to check there is credit left '
    + 'before starting work that consumes it.'),
  ours('scrape_screenshot', 'Capture a page as a PNG image, going through '
    + 'Bright Data’s unlocker so it works on sites with bot detection.'),
  ours('scrape_metadata', 'Fetch a page and return its HTTP status code, '
    + 'response headers and body as structured JSON, rather than converted '
    + 'text — for inspecting redirects, content type, or reachability.'),
]

const ECOMMERCE_EXTRA: Tool[] = [
  up('web_data_amazon_product', 'Quickly read structured Amazon product '
    + 'data. Requires a valid product URL containing /dp/. Often faster and '
    + 'more reliable than scraping.'),
  up('web_data_amazon_product_reviews', 'Quickly read structured Amazon '
    + 'product review data. Requires a valid product URL containing /dp/.'),
  up('web_data_amazon_product_search', 'Retrieve structured Amazon search '
    + 'results. Requires a search keyword and Amazon domain URL; limited to '
    + 'the first page of results.'),
  up('web_data_walmart_product', 'Quickly read structured Walmart product '
    + 'data. Requires a product URL containing /ip/.'),
  up('web_data_walmart_seller', 'Quickly read structured Walmart seller '
    + 'data. Requires a valid Walmart seller URL.'),
  up('web_data_ebay_product', 'Quickly read structured eBay product data. '
    + 'Requires a valid eBay product URL.'),
  up('web_data_homedepot_products', 'Quickly read structured Home Depot '
    + 'product data. Requires a valid homedepot.com product URL.'),
  up('web_data_zara_products', 'Quickly read structured Zara product data. '
    + 'Requires a valid Zara product URL.'),
  up('web_data_etsy_products', 'Quickly read structured Etsy product data. '
    + 'Requires a valid Etsy product URL.'),
  up('web_data_bestbuy_products', 'Quickly read structured Best Buy '
    + 'product data. Requires a valid Best Buy product URL.'),
  up('web_data_google_shopping', 'Quickly read structured Google Shopping '
    + 'product data. Requires a valid Google Shopping product URL.'),
]

const SOCIAL_EXTRA: Tool[] = [
  up('web_data_linkedin_person_profile', 'Quickly read structured LinkedIn '
    + 'people profile data. Requires a valid LinkedIn profile URL.'),
  up('web_data_linkedin_company_profile', 'Quickly read structured '
    + 'LinkedIn company profile data. Requires a valid LinkedIn company '
    + 'URL.'),
  up('web_data_linkedin_job_listings', 'Quickly read structured LinkedIn '
    + 'job listings data. Requires a valid LinkedIn jobs or search URL.'),
  up('web_data_linkedin_posts', 'Quickly read structured LinkedIn posts '
    + 'data. Requires a valid LinkedIn post URL.'),
  up('web_data_linkedin_people_search', 'Quickly read structured LinkedIn '
    + 'people search data. Requires a LinkedIn people search URL.'),
  up('list_dataset_fields', 'List the filterable fields of a searchable '
    + 'dataset (field name, type, and description). Call this before '
    + 'search_dataset.'),
  up('search_dataset', 'Search a Bright Data dataset by a filter and get '
    + 'matching records back directly — fast Elasticsearch-backed '
    + 'search, no trigger/poll cycle.'),
  up('web_data_instagram_profiles', 'Quickly read structured Instagram '
    + 'profile data. Requires a valid Instagram profile URL.'),
  up('web_data_instagram_posts', 'Quickly read structured Instagram post '
    + 'data. Requires a valid Instagram post URL.'),
  up('web_data_instagram_reels', 'Quickly read structured Instagram reel '
    + 'data. Requires a valid Instagram reel URL.'),
  up('web_data_instagram_comments', 'Quickly read structured Instagram '
    + 'comments data. Requires a valid Instagram URL.'),
  up('web_data_facebook_posts', 'Quickly read structured Facebook post '
    + 'data. Requires a valid Facebook post URL.'),
  up('web_data_facebook_marketplace_listings', 'Quickly read structured '
    + 'Facebook Marketplace listing data. Requires a valid listing URL.'),
  up('web_data_facebook_company_reviews', 'Quickly read structured '
    + 'Facebook company reviews data. Requires a company URL and review '
    + 'count.'),
  up('web_data_facebook_events', 'Quickly read structured Facebook events '
    + 'data. Requires a valid Facebook event URL.'),
  up('web_data_tiktok_profiles', 'Quickly read structured TikTok profile '
    + 'data. Requires a valid TikTok profile URL.'),
  up('web_data_tiktok_posts', 'Quickly read structured TikTok post data. '
    + 'Requires a valid TikTok post URL.'),
  up('web_data_tiktok_shop', 'Quickly read structured TikTok Shop product '
    + 'data. Requires a valid TikTok Shop product URL.'),
  up('web_data_tiktok_comments', 'Quickly read structured TikTok comments '
    + 'data. Requires a valid TikTok video URL.'),
  up('web_data_x_posts', 'Quickly read structured X (Twitter) post data. '
    + 'Requires a valid X post URL.'),
  up('web_data_x_profile_posts', 'Quickly read structured X (Twitter) '
    + 'profile posts. Requires a valid X profile URL.'),
  up('web_data_youtube_profiles', 'Quickly read structured YouTube channel '
    + 'profile data. Requires a valid YouTube channel URL.'),
  up('web_data_youtube_comments', 'Quickly read structured YouTube '
    + 'comments data. Requires a video URL and optional comment count.'),
  up('web_data_youtube_videos', 'Quickly read structured YouTube video '
    + 'metadata. Requires a valid YouTube video URL.'),
  up('web_data_reddit_posts', 'Quickly read structured Reddit post data. '
    + 'Requires a valid Reddit post URL.'),
  up('web_data_reddit_comments', 'Quickly read structured Reddit comments '
    + 'data. Accepts an optional days_back parameter.'),
]

const BROWSER: Tool[] = [
  up('scraping_browser_navigate', 'Open or reuse a scraping-browser session '
    + 'and navigate to the provided URL, resetting tracked network '
    + 'requests.'),
  up('scraping_browser_go_back', 'Navigate the active session back to the '
    + 'previous page and report the new URL and title.'),
  up('scraping_browser_go_forward', 'Navigate the active session forward '
    + 'to the next page and report the new URL and title.'),
  up('scraping_browser_snapshot', 'Capture an ARIA snapshot of the current '
    + 'page listing interactive elements and their refs for later '
    + 'ref-based actions.'),
  up('scraping_browser_fill_form', 'Fill multiple form fields in one call '
    + 'using refs from the latest ARIA snapshot.'),
  up('scraping_browser_click_ref', 'Click an element using its ref from '
    + 'the latest ARIA snapshot; requires a ref and human-readable element '
    + 'description.'),
  up('scraping_browser_type_ref', 'Fill an element identified by ref from '
    + 'the ARIA snapshot, optionally pressing Enter to submit after '
    + 'typing.'),
  up('scraping_browser_screenshot', 'Capture a screenshot of the current '
    + 'page; supports optional full_page mode.'),
  up('scraping_browser_network_requests', 'List the network requests '
    + 'recorded since page load with method, URL, and response status.'),
  up('scraping_browser_wait_for_ref', 'Wait until an element identified by '
    + 'ARIA ref becomes visible, with an optional timeout.'),
  up('scraping_browser_get_text', 'Return the text content of the current '
    + 'page’s body element.'),
  up('scraping_browser_get_html', 'Return the HTML content of the current '
    + 'page.'),
  up('scraping_browser_scroll', 'Scroll to the bottom of the current page.'),
  up('scraping_browser_scroll_to_ref', 'Scroll the page until the element '
    + 'referenced in the ARIA snapshot is in view.'),
  up('scraping_browser_select_ref', 'Choose an option in a dropdown by its '
    + 'visible label.'),
  up('scraping_browser_check_ref', 'Tick a checkbox or select a radio '
    + 'button. Does nothing if already ticked.'),
  up('scraping_browser_uncheck_ref', 'Untick a checkbox. Does nothing if '
    + 'already unticked.'),
  up('scraping_browser_hover_ref', 'Move the mouse over an element, to '
    + 'open hover menus or reveal content that only appears on hover.'),
  up('scraping_browser_reload', 'Reload the current page — useful '
    + 'after an action that changed server-side state, or to retry.'),
  up('scraping_browser_cookies', 'List the cookies the current browser '
    + 'session holds, to check session or consent state.'),
  up('scraping_browser_close_session', 'Close the browser and end the '
    + 'session. The next browser tool call starts a fresh one.'),
]

const FINANCE: Tool[] = [
  up('web_data_yahoo_finance_business', 'Quickly read structured Yahoo '
    + 'Finance company profile data. Requires a valid Yahoo Finance '
    + 'business URL.'),
]

const BUSINESS_EXTRA: Tool[] = [
  up('web_data_crunchbase_company', 'Quickly read structured Crunchbase '
    + 'company data. Requires a valid Crunchbase company URL.'),
  up('web_data_zoominfo_company_profile', 'Quickly read structured '
    + 'ZoomInfo company profile data. Requires a valid ZoomInfo company '
    + 'URL.'),
  up('web_data_google_maps_reviews', 'Quickly read structured Google Maps '
    + 'reviews data. Requires a Maps URL and optional days_limit.'),
  up('web_data_zillow_properties_listing', 'Quickly read structured '
    + 'Zillow property listing data. Requires a valid Zillow listing URL.'),
  up('web_data_booking_hotel_listings', 'Quickly read structured '
    + 'Booking.com hotel listing data. Requires a valid Booking.com '
    + 'listing URL.'),
]

const RESEARCH_EXTRA: Tool[] = [
  up('web_data_github_repository_file', 'Quickly read structured GitHub '
    + 'repository file data. Requires a valid GitHub file URL.'),
  up('web_data_reuter_news', 'Quickly read structured Reuters news data. '
    + 'Requires a valid Reuters article URL.'),
]

const APP_STORES: Tool[] = [
  up('web_data_google_play_store', 'Quickly read structured Google Play '
    + 'Store app data. Requires a valid Play Store app URL.'),
  up('web_data_apple_app_store', 'Quickly read structured Apple App Store '
    + 'app data. Requires a valid App Store app URL.'),
]

const TRAVEL: Tool[] = [
  up('web_data_booking_hotel_listings', 'Quickly read structured '
    + 'Booking.com hotel listing data. Requires a valid Booking.com '
    + 'listing URL.'),
]

const ADVANCED_SCRAPING: Tool[] = [
  up('search_engine_batch', 'Run up to 10 search queries in parallel. '
    + 'Returns JSON for Google results and Markdown for Bing/Yandex.'),
  up('scrape_batch', 'Scrape up to 10 webpages in one request and return '
    + 'an array of URL/content pairs in Markdown format.'),
  up('scrape_as_html', 'Scrape a single webpage with advanced extraction '
    + 'and return the HTML response body.'),
  ...ACCOUNT_TOOLS.filter(t => t.name.startsWith('scrape_')),
  up('extract', 'Scrape a webpage as Markdown and convert it to structured '
    + 'JSON using AI sampling, with an optional custom extraction prompt.'),
  up('session_stats', 'Report how many times each tool has been called '
    + 'during the current MCP session.'),
]

const GEO: Tool[] = [
  up('web_data_chatgpt_ai_insights', 'Send a prompt to ChatGPT and get back '
    + 'AI-generated insights: answer text, citations, recommendations, and '
    + 'markdown. Useful for GEO and LLM-as-a-judge.'),
  up('web_data_grok_ai_insights', 'Send a prompt to Grok and get back '
    + 'AI-generated insights as structured markdown.'),
  up('web_data_perplexity_ai_insights', 'Send a prompt to Perplexity and '
    + 'get back AI-generated insights as structured markdown.'),
]

const CODE: Tool[] = [
  up('web_data_npm_package', 'Quickly read structured npm package data '
    + 'including latest version, README, dependencies, and metadata.'),
  up('web_data_pypi_package', 'Quickly read structured PyPI package data '
    + 'including latest version, README, dependencies, and metadata.'),
]

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'scraper_studio',
    name: 'Scraper Studio',
    description: 'Build, run and self-heal custom scrapers for sites no '
      + 'pre-built extractor covers. This fork’s core contribution.',
    tools: [...BASE, ...SCRAPER_STUDIO_TOOLS],
  },
  {
    id: 'account',
    name: 'Account',
    description: 'Zones, balance and spend for the Bright Data account, '
      + 'plus two extra scrape output formats.',
    tools: [...BASE, ...ACCOUNT_TOOLS],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Retail and marketplace datasets for product intel.',
    tools: [...BASE, ...ECOMMERCE_EXTRA],
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Social networks, UGC platforms, and creator insights.',
    tools: [...BASE, ...SOCIAL_EXTRA],
  },
  {
    id: 'browser',
    name: 'Browser Automation',
    description: 'Bright Data Scraping Browser tools for live automation.',
    tools: [...BASE, ...BROWSER],
  },
  {
    id: 'finance',
    name: 'Finance Intelligence',
    description: 'Company, financial, and location intelligence datasets.',
    tools: [...BASE, ...FINANCE],
  },
  {
    id: 'business',
    name: 'Business Intelligence',
    description: 'Company and location intelligence datasets.',
    tools: [...BASE, ...BUSINESS_EXTRA],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'App stores, news, and developer data feeds.',
    tools: [...BASE, ...RESEARCH_EXTRA],
  },
  {
    id: 'app_stores',
    name: 'App Stores',
    description: 'App store listing data.',
    tools: [...BASE, ...APP_STORES],
  },
  {
    id: 'travel',
    name: 'Travel',
    description: 'Travel booking information.',
    tools: [...BASE, ...TRAVEL],
  },
  {
    id: 'advanced_scraping',
    name: 'Advanced Scraping',
    description: 'Higher-throughput scraping utilities and batch helpers.',
    tools: [...BASE, ...ADVANCED_SCRAPING],
  },
  {
    id: 'geo',
    name: 'GEO & LLM Visibility',
    description: 'Measure and analyze AI/LLM brand visibility and '
      + 'generative engine optimization.',
    tools: [...BASE, ...GEO],
  },
  {
    id: 'code',
    name: 'Code',
    description: 'Developer tools and package information datasets.',
    tools: [...BASE, ...CODE],
  },
]

// Deduplicated across every group, the way tool_groups.js counts them.
export function all_tools(): Tool[] {
  const seen = new Map<string, Tool>()
  for (const group of TOOL_GROUPS) {
    for (const tool of group.tools)
      seen.set(tool.name, tool)
  }
  return [...seen.values()]
}

export function total_tool_count(): number {
  return all_tools().length
}

export function ours_tool_count(): number {
  return all_tools().filter(t => t.origin === 'ours').length
}
