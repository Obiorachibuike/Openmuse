import './style.css';
const api = 'https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1';
const definitions = [
  { label: 'Health', method: 'GET', path: '/health', body: '' }, { label: 'Models', method: 'GET', path: '/models', body: '' },
  { label: 'Text generation', method: 'POST', path: '/text', body: '{\n  "prompt": "Explain AI in simple terms."\n}' },
  { label: 'Chat', method: 'POST', path: '/chat', body: '{\n  "messages": [{ "role": "user", "content": "What is TypeScript?" }]\n}' },
  { label: 'Chat stream (SSE)', method: 'POST', path: '/chat/stream', body: '{\n  "messages": [{ "role": "user", "content": "Explain neural networks." }]\n}' },
  { label: 'Image generation', method: 'POST', path: '/images/generations', body: '{\n  "prompt": "A calm futuristic city at sunset."\n}' },
  { label: 'Image retrieval', method: 'GET', path: '/images/img_REPLACE_WITH_ID', body: '' },
  { label: 'Vision', method: 'POST', path: '/vision', body: '{\n  "image_url": "https://example.org/image.jpg",\n  "prompt": "Describe this image."\n}' },
  { label: 'OpenAPI spec', method: 'GET', path: '/openapi.json', body: '' },
];
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header class="topbar"><a class="brand" href="#overview"><span class="brand-mark">✳</span> openmuse</a><nav class="topnav"><a href="#quickstart">Quickstart</a><a href="#api">API reference</a><a href="#sdks">SDKs</a><a href="#playground">Playground</a></nav><button id="search-open" class="search-open" aria-label="Search documentation">⌕ <span>Search docs</span> <kbd>⌘ K</kbd></button><div class="topright"><a class="status" href="#status"><i></i> API status</a><a class="github" href="https://github.com/Obiorachibuike/Openmuse" target="_blank" rel="noreferrer">GitHub ↗</a></div><button class="mobile-menu" aria-label="Toggle navigation">☰</button></header>
<div class="layout"><aside class="sidebar"><div class="side-label">GET STARTED</div><a href="#overview" class="active">Overview</a><a href="#quickstart">Quickstart</a><a href="#sdks">SDKs</a><div class="side-label spaced">API REFERENCE</div><a href="#api">Endpoints</a><a href="#streaming">Streaming</a><a href="#models">Models</a><a href="#errors">Errors &amp; limits</a><a href="#openapi">OpenAPI spec</a><div class="side-label spaced">RESOURCES</div><a href="#playground">API playground</a><a href="#status">Status</a><div class="sidebar-bottom"><span class="live-dot"></span> Public API · v1</div></aside>
<main><section class="hero" id="overview"><div class="eyebrow"><span class="pill">API v1</span> THE DEVELOPER PLATFORM FOR AI</div><h1>AI that speaks<br/><span>your language.</span></h1><p class="hero-copy">One simple API. Official SDKs for TypeScript and Python. Build with text, chat, vision, and image generation—without wrestling with infrastructure.</p><div class="hero-actions"><a class="btn primary" href="#quickstart">Start building <span>→</span></a><a class="btn secondary" href="#playground">Explore the API</a></div><div class="hero-note"><span>✦</span> Public endpoints are keyless. Usage is rate-limited and capacity-dependent.</div><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="hero-glow"></div></section>
<section class="section" id="quickstart"><div class="section-heading"><div><div class="eyebrow">A FAST FIRST CALL</div><h2>Start with what you know.</h2></div><p>Use REST directly or bring the official SDK into your app. No client API key required.</p></div><div class="choice-grid"><article class="choice"><div class="choice-top"><span class="choice-icon">⌘</span><span class="tag">HTTP</span></div><h3>REST API</h3><p>Use any language with a standard HTTP client.</p><pre><code>curl ${api}/health</code></pre><a href="#api">Read API reference <b>→</b></a></article><article class="choice"><div class="choice-top"><span class="choice-icon js-icon">TS</span><span class="tag">TYPESCRIPT</span></div><h3>JavaScript SDK</h3><p>Typed resources, ergonomic requests, real SSE streaming.</p><pre><code>npm install ./packages/javascript</code></pre><a href="#sdks">View SDK docs <b>→</b></a></article><article class="choice"><div class="choice-top"><span class="choice-icon py-icon">Py</span><span class="tag">PYTHON</span></div><h3>Python SDK</h3><p>A small, typed client with streaming and clean errors.</p><pre><code>pip install ./packages/python</code></pre><a href="#sdks">View SDK docs <b>→</b></a></article></div></section>
<section class="section dark-panel" id="sdks"><div class="section-heading"><div><div class="eyebrow">OFFICIAL CLIENT LIBRARIES</div><h2>Stay in your flow.</h2></div><p>One familiar interface for every OpenMuse capability.</p></div><div class="sdk-grid"><div class="sdk-card"><div class="sdk-head"><span class="choice-icon js-icon">TS</span><div><h3>JavaScript / TypeScript</h3><small>@openmuse-ai/sdk · v1.0.0 · local package</small></div></div><pre><code><span class="muted">import</span> { OpenMuse } <span class="muted">from</span> '@openmuse-ai/sdk';

<span class="muted">const</span> muse = <span class="keyword">new</span> OpenMuse();
<span class="muted">const</span> result = <span class="keyword">await</span> muse.text.generate({
  prompt: 'Explain APIs simply.'
});
console.log(result.output.text);</code></pre><div class="sdk-foot"><span>ESM · TypeScript · Node 18+</span><span>Build locally <b>↗</b></span></div></div><div class="sdk-card"><div class="sdk-head"><span class="choice-icon py-icon">Py</span><div><h3>Python</h3><small>openmuse-ai · v1.0.0 · local package</small></div></div><pre><code><span class="muted">from</span> openmuse <span class="muted">import</span> OpenMuse

<span class="keyword">with</span> OpenMuse() <span class="keyword">as</span> muse:
    result = muse.text.generate(
        prompt="Explain APIs simply."
    )
    print(result.output.text)</code></pre><div class="sdk-foot"><span>Python 3.9+ · httpx</span><span>Build locally <b>↗</b></span></div></div></div><p class="publish-note">Packages are implemented and buildable from this repository. They have <strong>not been published</strong> to npm or PyPI yet.</p></section>
<section class="section" id="api"><div class="section-heading"><div><div class="eyebrow">API REFERENCE</div><h2>One endpoint per capability.</h2></div><p>Versioned, JSON-first, and built for predictable integration.</p></div><div class="endpoint-list"><div><span class="method get">GET</span><code>/health</code><span>Service health and version</span></div><div><span class="method get">GET</span><code>/models</code><span>Configured models and capabilities</span></div><div><span class="method post">POST</span><code>/text</code><span>Text generation</span></div><div><span class="method post">POST</span><code>/chat</code><span>Chat completion</span></div><div><span class="method post">POST</span><code>/chat/stream</code><span>Incremental SSE chat</span></div><div><span class="method post">POST</span><code>/images/generations</code><span>Generate and store an image</span></div><div><span class="method get">GET</span><code>/images/{id}</code><span>Retrieve generated image bytes</span></div><div><span class="method post">POST</span><code>/vision</code><span>Analyze an image</span></div></div></section>
<section class="section stream-section" id="streaming"><div class="stream-copy"><div class="eyebrow">GENUINE STREAMING</div><h2>Tokens as they happen.</h2><p>Chat streaming forwards incremental content from the configured upstream provider. OpenMuse does not buffer a completed answer and split it into pretend chunks.</p><p class="subtle">SSE event types: <code>message_start</code>, <code>content_delta</code>, <code>message_end</code>, and <code>error</code>. Streams end with <code>data: [DONE]</code>. Requires explicitly enabled native upstream support.</p></div><pre class="terminal"><span class="terminal-dot"></span><span class="terminal-dot yellow"></span><span class="terminal-dot green"></span><code>event: message_start
data: {"id":"chat_…"}

event: content_delta
data: {"text":"Tokens "}

event: content_delta
data: {"text":"as they happen."}

event: message_end
data: {"finish_reason":"stop"}

data: [DONE]</code></pre></section>
<section class="section" id="models"><div class="section-heading"><div><div class="eyebrow">CAPABILITY DISCOVERY</div><h2>Only what is configured.</h2></div><p>The model registry advertises models only when credentials and a configured route exist.</p></div><div class="callout"><span>ⓘ</span><p>When no provider is configured, <code>GET /models</code> returns an empty list and generation calls return <code>503 MODEL_UNAVAILABLE</code>. A capability is never implied by a placeholder model.</p><a href="#playground">Try models <b>→</b></a></div></section>
<section class="section explorer-section" id="playground"><div class="section-heading"><div><div class="eyebrow">LIVE API EXPLORER</div><h2>Try an endpoint.</h2></div><p>Requests go to the configured API URL. Calls can consume operator capacity; generation endpoints may invoke billable inference.</p></div><div class="explorer"><div class="explorer-bar"><div class="explorer-title"><span class="live-dot"></span> Playground <span class="tag">LIVE REQUESTS</span></div><label>API base URL <input id="base-url" value="${api}" aria-label="API base URL"/></label></div><div class="explorer-controls"><label>Endpoint<select id="endpoint">${definitions.map((d, i) => `<option value="${i}">${d.method}  ${d.path} — ${d.label}</option>`).join('')}</select></label><button id="send" class="btn primary">Send request <span>→</span></button><button id="copy-example" class="btn secondary">Copy cURL</button></div><div class="request-meta"><span id="method" class="method get">GET</span><code id="url"></code><button id="copy-url" class="icon-button" aria-label="Copy endpoint URL">▢</button></div><div class="explorer-body"><div class="request-pane"><div class="pane-head"><span>REQUEST BODY</span><span>JSON</span></div><textarea id="request-body" spellcheck="false" aria-label="JSON request body"></textarea><div class="code-tabs"><button class="selected" data-lang="curl">cURL</button><button data-lang="javascript">JavaScript</button><button data-lang="python">Python</button></div><pre id="code-example"></pre></div><div class="response-pane"><div class="pane-head"><span>RESPONSE</span><span id="response-meta">Ready</span></div><pre id="response" class="response-output"><span class="empty-icon">◌</span>
Send a request to see the real response here.</pre></div></div><div class="explorer-foot"><span>🔒 No API key is sent or required for public routes.</span><span id="response-status"></span></div></div></section>
<section class="section" id="errors"><div class="section-heading"><div><div class="eyebrow">RELIABILITY &amp; SAFETY</div><h2>Clear errors. Sensible limits.</h2></div><p>Structured responses help your app handle issues without guessing.</p></div><div class="error-grid"><div><span class="method post">429</span><h3>Rate limited</h3><p>Per-IP, with stricter limits for image generation and vision. Responses include <code>Retry-After</code>.</p></div><div><span class="method get">503</span><h3>Not configured</h3><p>Clear response when provider credentials or capacity aren't available. No fabricated success.</p></div><div><span class="method post">400</span><h3>Invalid request</h3><p>Inputs, generation parameters, and image requests are validated before dispatch.</p></div></div><div class="error-sample"><pre><code>{
  "error": {
    "type": "rate_limit_error",
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMIT_EXCEEDED",
    "request_id": "req_…"
  }
}</code></pre><p>Limits are safeguards, not an unlimited free-use promise. Local process rate limits need a shared store for multi-instance production.</p></div></section>
<section class="section openapi-section" id="openapi"><div class="section-heading"><div><div class="eyebrow">CONTRACT FIRST</div><h2>Built to be explored.</h2></div><a class="btn secondary" href="${api}/openapi.json" target="_blank" rel="noreferrer">View OpenAPI JSON ↗</a></div><p>OpenAPI 3.1 document: <code>${api}/openapi.json</code>. Check it into your workflow, generate integrations, and inspect every public route.</p></section>
<section class="section status-section" id="status"><div class="status-card"><div><div class="eyebrow">SERVICE STATUS</div><h2>Check availability directly.</h2><p>The public health endpoint reports service process status, not provider readiness.</p></div><a class="btn secondary" href="${api}/health" target="_blank" rel="noreferrer">Open health endpoint ↗</a></div></section><footer><a class="brand" href="#overview"><span class="brand-mark">✳</span> openmuse</a><span>Build openly. Make something useful.</span><span>API v1 · MIT licensed SDKs</span></footer></main></div>
<div id="search-modal" class="search-modal" aria-hidden="true"><div class="search-box" role="dialog" aria-modal="true" aria-labelledby="search-title"><div class="search-row"><span id="search-title" class="sr-only">Search OpenMuse documentation</span><span aria-hidden="true">⌕</span><input id="search-input" type="search" placeholder="Search docs, endpoints, and guides…" aria-label="Search documentation"/><button id="search-close" aria-label="Close search">Esc</button></div><div id="search-results" aria-label="Documentation search results"></div></div></div>`;

const endpoint = document.querySelector<HTMLSelectElement>('#endpoint')!;
const textarea = document.querySelector<HTMLTextAreaElement>('#request-body')!;
const baseInput = document.querySelector<HTMLInputElement>('#base-url')!;
const urlNode = document.querySelector<HTMLElement>('#url')!;
const methodNode = document.querySelector<HTMLElement>('#method')!;
const responseNode = document.querySelector<HTMLElement>('#response')!;
const codeNode = document.querySelector<HTMLElement>('#code-example')!;
let currentLang = 'curl';
function selected() { return definitions[Number(endpoint.value)]!; }
function url() { return baseInput.value.replace(/\/$/, '') + selected().path; }
function makeCurl() { const d = selected(); return `curl -i -X ${d.method} '${url()}'${d.body ? ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${textarea.value.replaceAll("'", "'\\''")}'` : ''}`; }
function renderCode() {
  const d = selected(); let json = textarea.value || '{}';
  try { json = JSON.stringify(JSON.parse(json), null, 2); } catch { /* keep invalid draft visible */ }
  let code = '';
  if (currentLang === 'curl') code = makeCurl();
  if (currentLang === 'javascript') code = `const response = await fetch('${url()}', {\n  method: '${d.method}',${d.body ? `\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(${json})` : ''}\n});\n${d.path.endsWith('stream') ? 'for await (const chunk of response.body) console.log(chunk);' : 'const result = await response.json(); console.log(result);'}`;
  if (currentLang === 'python') code = `import requests\n\nresponse = requests.${d.method.toLowerCase()}('${url()}'${d.body ? `, json=${json}` : ''})\nprint(response.text if response.headers.get('content-type', '').startswith('text/event-stream') else response.json())`;
  codeNode.textContent = code;
}
function updateEndpoint() { const d = selected(); textarea.value = d.body; methodNode.textContent = d.method; methodNode.className = `method ${d.method.toLowerCase()}`; urlNode.textContent = url(); textarea.disabled = !d.body; renderCode(); }
endpoint.addEventListener('change', updateEndpoint); baseInput.addEventListener('input', () => { urlNode.textContent = url(); renderCode(); }); textarea.addEventListener('input', renderCode);
document.querySelectorAll<HTMLButtonElement>('.code-tabs button').forEach(b => b.addEventListener('click', () => { document.querySelector('.code-tabs .selected')?.classList.remove('selected'); b.classList.add('selected'); currentLang = b.dataset.lang!; document.querySelector<HTMLButtonElement>('#copy-example')!.textContent = `Copy ${currentLang === 'javascript' ? 'JavaScript' : currentLang}`; renderCode(); }));
updateEndpoint();
async function copy(text: string, btn: HTMLButtonElement) { try { await navigator.clipboard.writeText(text); const old = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = old, 1200); } catch { btn.textContent = 'Copy unavailable'; } }
document.querySelector<HTMLButtonElement>('#copy-example')!.addEventListener('click', e => copy(codeNode.textContent!, e.currentTarget as HTMLButtonElement));
document.querySelector<HTMLButtonElement>('#copy-url')!.addEventListener('click', e => copy(url(), e.currentTarget as HTMLButtonElement));
document.querySelector<HTMLButtonElement>('#send')!.addEventListener('click', async e => {
  const button = e.currentTarget as HTMLButtonElement; const d = selected(); button.disabled = true; button.innerHTML = '<span class="spinner"></span> Sending…'; responseNode.textContent = 'Waiting for response…'; document.querySelector('#response-status')!.textContent = ''; document.querySelector('#response-meta')!.textContent = 'Request running'; const started = performance.now();
  try {
    const init: RequestInit = { method: d.method, headers: d.body ? { 'Content-Type': 'application/json' } : undefined };
    if (d.body) { try { init.body = JSON.stringify(JSON.parse(textarea.value)); } catch { throw new Error('Request body is not valid JSON.'); } }
    const res = await fetch(url(), init); const elapsed = Math.round(performance.now() - started); document.querySelector('#response-status')!.textContent = `${res.status} ${res.statusText}`; document.querySelector('#response-status')!.className = res.ok ? 'ok' : 'bad'; document.querySelector('#response-meta')!.textContent = `${elapsed} ms`;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('text/event-stream')) { const reader = res.body?.getReader(); const decoder = new TextDecoder(); let streamText = ''; while (reader) { const { value, done } = await reader.read(); if (done) break; streamText += decoder.decode(value, { stream: true }); responseNode.textContent = streamText; } streamText += decoder.decode(); responseNode.textContent = streamText || '(empty stream)'; }
    else if (ct.startsWith('image/')) responseNode.textContent = `Image response · ${res.headers.get('content-type')} · ${res.headers.get('content-length') ?? 'unknown'} bytes`;
    else { const text = await res.text(); try { responseNode.textContent = JSON.stringify(JSON.parse(text), null, 2); } catch { responseNode.textContent = text || '(empty response)'; } }
  } catch (err) { responseNode.textContent = `Request failed: ${err instanceof Error ? err.message : 'Unknown error'}\n\nCheck that the API is reachable and the selected route is configured. The playground never substitutes mock responses.`; document.querySelector('#response-status')!.textContent = 'Network / validation error'; document.querySelector('#response-status')!.className = 'bad'; document.querySelector('#response-meta')!.textContent = 'Failed'; }
  finally { button.disabled = false; button.innerHTML = 'Send request <span>→</span>'; }
});
document.querySelector<HTMLButtonElement>('.mobile-menu')!.addEventListener('click', () => document.querySelector('.sidebar')!.classList.toggle('open'));
document.querySelectorAll('.sidebar a').forEach(a => a.addEventListener('click', () => document.querySelector('.sidebar')!.classList.remove('open')));
const searchModal = document.querySelector<HTMLDivElement>('#search-modal')!; const searchInput = document.querySelector<HTMLInputElement>('#search-input')!; const searchResults = document.querySelector<HTMLDivElement>('#search-results')!;
const searchEntries = [['Overview','OpenMuse API platform','#overview'],['Quickstart','REST, JavaScript and Python setup','#quickstart'],['SDKs','Official TypeScript and Python client libraries','#sdks'],['API reference','Routes and request formats','#api'],['Text generation','POST /text prompts and output','#api'],['Chat','POST /chat completion','#api'],['Streaming','Incremental SSE chat events','#streaming'],['Image generation','POST /images/generations','#api'],['Image retrieval','GET /images/{id} bytes','#api'],['Vision','Analyze image inputs','#api'],['Models','Configured capabilities','#models'],['Errors and rate limits','Request IDs, limits and error codes','#errors'],['OpenAPI specification','OpenAPI 3.1 contract','#openapi'],['Playground','Send real API requests','#playground'],['Service status','Health endpoint','#status']] as const;
let lastFocus: HTMLElement | null = null;
function closeSearch() { searchModal.setAttribute('aria-hidden','true'); lastFocus?.focus(); }
function renderSearch(query: string) { const q = query.trim().toLowerCase(); const matches = searchEntries.filter(([title,desc]) => !q || `${title} ${desc}`.toLowerCase().includes(q)); searchResults.innerHTML = matches.length ? matches.map(([title,desc,href]) => `<a href="${href}"><span>${title}</span><small>${desc}</small><b>↗</b></a>`).join('') : '<p class="no-results">No matching docs. Try “streaming”, “models”, or “rate limits”.</p>'; searchResults.querySelectorAll('a').forEach(a => a.addEventListener('click',closeSearch)); }
function openSearch() { lastFocus = document.activeElement as HTMLElement; searchModal.setAttribute('aria-hidden','false'); searchInput.value=''; renderSearch(''); searchInput.focus(); }
document.querySelector<HTMLButtonElement>('#search-open')!.addEventListener('click',openSearch); document.querySelector<HTMLButtonElement>('#search-close')!.addEventListener('click',closeSearch); searchInput.addEventListener('input',()=>renderSearch(searchInput.value)); searchModal.addEventListener('click',e=>{if(e.target===searchModal)closeSearch();});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}if(e.key==='Escape'&&searchModal.getAttribute('aria-hidden')==='false')closeSearch();});
