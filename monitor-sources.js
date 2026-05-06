// ═══════════════════════════════════════════════════════════════════
// SafeScroll Australia — Automated Data Source Monitor
// ═══════════════════════════════════════════════════════════════════
// Runs weekly via GitHub Actions. Checks four data sources for new
// publications. If anything new is detected, creates a GitHub Issue
// with action items and emails the repo owner automatically.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), '.github', 'data', 'source-state.json');
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO; // e.g. "ai-ati/safescroll-australia"

// ── SOURCE DEFINITIONS ─────────────────────────────────────────────
const SOURCES = [
  {
    id: 'esafety',
    name: 'eSafety Commissioner',
    url: 'https://www.esafety.gov.au/newsroom/rss.xml',
    type: 'rss',
    relevance: ['research', 'children', 'social media', 'transparency', 'youth', 'minor', 'underage', 'platform']
  },
  {
    id: 'aihw',
    name: 'AIHW (Australian Institute of Health and Welfare)',
    url: 'https://www.aihw.gov.au/news-media/news/rss',
    type: 'rss',
    relevance: ['mental health', 'youth', 'children', 'social media', 'wellbeing', 'self-harm', 'adolescent', 'young people']
  },
  {
    id: 'pubmed',
    name: 'PubMed (peer-reviewed research)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/rss/search/1aQ8jbAr-X-eCb6JlNqMq3lZUjsYRG_DEQYn4dLsHm9lMvW0pe/?limit=15&utm_campaign=pubmed-2&fc=20240101000000',
    type: 'rss',
    relevance: ['social media', 'australia', 'australian', 'youth', 'adolescent', 'mental health', 'depression', 'anxiety']
  },
  {
    id: 'abs-mental-health',
    name: 'ABS Mental Health Statistics',
    url: 'https://www.abs.gov.au/statistics/health/mental-health',
    type: 'page-watch',
    relevance: []
  }
];

// ── HELPERS ────────────────────────────────────────────────────────

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SafeScroll-Australia-Monitor/1.0 (+https://github.com/' + REPO + ')'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

// Lightweight RSS parser (no external deps needed)
function parseRSS(xml) {
  const items = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/g) || xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
  for (const item of itemMatches) {
    const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/) ||
                  item.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ||
                     item.match(/<published>([\s\S]*?)<\/published>/) ||
                     item.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || '';
    const description = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/) ||
                         item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] || '';

    const cleanText = (s) => s.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
                              .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

    if (title && link) {
      items.push({
        title: cleanText(title),
        link: cleanText(link),
        pubDate: cleanText(pubDate),
        description: cleanText(description).substring(0, 300)
      });
    }
  }
  return items;
}

// Check if an item is relevant based on keywords
function isRelevant(item, keywords) {
  if (!keywords.length) return true;
  const text = (item.title + ' ' + item.description).toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

// Hash a string (for page-watch detection)
function hashContent(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h.toString(16);
}

// ── STATE MANAGEMENT ───────────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) { console.log('No existing state — starting fresh.'); }
  return { sources: {}, lastRun: null };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── GITHUB ISSUE CREATION ─────────────────────────────────────────

async function createIssue(title, body, labels) {
  const url = `https://api.github.com/repos/${REPO}/issues`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, body, labels })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create issue: ${res.status} ${errText}`);
  }
  const data = await res.json();
  console.log(`✅ Created issue #${data.number}: ${title}`);
  return data;
}

// ── MAIN ───────────────────────────────────────────────────────────

(async () => {
  console.log('🔍 SafeScroll Source Monitor — starting check...\n');
  const state = loadState();
  const allNewItems = [];

  for (const src of SOURCES) {
    console.log(`Checking: ${src.name}`);
    try {
      const content = await fetchUrl(src.url);

      if (src.type === 'rss') {
        const items = parseRSS(content);
        const relevantItems = items.filter(item => isRelevant(item, src.relevance));
        console.log(`  Found ${items.length} items (${relevantItems.length} relevant)`);

        const knownLinks = new Set((state.sources[src.id]?.knownLinks) || []);
        const newItems = relevantItems.filter(item => !knownLinks.has(item.link));

        if (newItems.length > 0) {
          console.log(`  🆕 ${newItems.length} new relevant items detected`);
          allNewItems.push({ source: src, items: newItems });
        }

        // Update state with all current relevant links (cap at 100 to limit file size)
        const allCurrentLinks = relevantItems.map(i => i.link);
        const merged = [...new Set([...allCurrentLinks, ...knownLinks])].slice(0, 100);
        state.sources[src.id] = { knownLinks: merged, lastChecked: new Date().toISOString() };

      } else if (src.type === 'page-watch') {
        const hash = hashContent(content.substring(0, 50000)); // first 50KB
        const lastHash = state.sources[src.id]?.contentHash;
        if (lastHash && lastHash !== hash) {
          console.log(`  🆕 Page content changed`);
          allNewItems.push({
            source: src,
            items: [{ title: `${src.name} page content updated`, link: src.url, pubDate: new Date().toISOString(), description: 'The monitored page has changed since last check. Review for new statistics or publications.' }]
          });
        }
        state.sources[src.id] = { contentHash: hash, lastChecked: new Date().toISOString() };
      }
    } catch (err) {
      console.log(`  ⚠️ Error checking ${src.name}: ${err.message}`);
    }
  }

  state.lastRun = new Date().toISOString();
  saveState(state);

  // ── Build issue if there's anything new ───────────────────────
  if (allNewItems.length === 0) {
    console.log('\n✓ No new relevant content found. Nothing to alert.');
    return;
  }

  let totalNew = 0;
  let body = `## Weekly Data Source Monitor — New Content Detected\n\n`;
  body += `Hello! Your automated source monitor has detected new publications relevant to SafeScroll Australia. Review the items below and update the site and AI Worker if appropriate.\n\n`;
  body += `**Run date:** ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} (Sydney time)\n\n---\n\n`;

  for (const { source, items } of allNewItems) {
    body += `### 📌 ${source.name}\n\n`;
    for (const item of items.slice(0, 10)) { // cap per source
      totalNew++;
      body += `- **[${item.title}](${item.link})**\n`;
      if (item.pubDate) body += `  Published: ${item.pubDate}\n`;
      if (item.description) body += `  ${item.description.substring(0, 200)}...\n`;
      body += `\n`;
    }
    body += `\n`;
  }

  body += `---\n\n## Action Checklist\n\n`;
  body += `When you have time to review (typically 30–60 minutes):\n\n`;
  body += `- [ ] Open each link above and assess whether it contains new statistics, findings, or platform data relevant to SafeScroll\n`;
  body += `- [ ] If a new statistic supersedes one currently shown on the site, update it in \`index.html\` (search for the old number with Ctrl+F)\n`;
  body += `- [ ] Update the matching entry in your Cloudflare Worker's \`SYSTEM_PROMPT\` so the AI Assistant reflects the new data\n`;
  body += `- [ ] Update the **"Data last reviewed"** badge in the hero section to today's date\n`;
  body += `- [ ] If a major new finding emerges, consider adding a new card to the Findings section\n`;
  body += `- [ ] Close this issue once review is complete\n\n`;
  body += `---\n\n`;
  body += `*This issue was created automatically by \`.github/workflows/monitor-sources.yml\`.*\n`;
  body += `*To stop receiving these alerts, disable the workflow in Actions → SafeScroll Data Source Monitor → Disable.*\n`;
  body += `*To run a check manually right now, go to Actions → SafeScroll Data Source Monitor → Run workflow.*\n`;

  await createIssue(
    `📊 Source Update — ${totalNew} new item${totalNew === 1 ? '' : 's'} (${new Date().toISOString().slice(0,10)})`,
    body,
    ['data-update', 'automated']
  );

  console.log(`\n✅ Issue created with ${totalNew} new items across ${allNewItems.length} sources.`);
})().catch(err => {
  console.error('❌ Monitor failed:', err);
  process.exit(1);
});
