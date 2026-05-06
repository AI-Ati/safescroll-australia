// ═══════════════════════════════════════════════════════════════════
// SafeScroll Australia — Automated Data Source Monitor v2
// ═══════════════════════════════════════════════════════════════════
// Uses Google News RSS (reliable for any site) + official PubMed RSS
// to monitor publications. Creates GitHub issues when new relevant
// content is detected. Works around 403/blocking issues.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), '.github', 'data', 'source-state.json');
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;

// ── SOURCE DEFINITIONS ─────────────────────────────────────────────
const SOURCES = [
  {
    id: 'esafety-news',
    name: 'eSafety Commissioner (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:esafety.gov.au+(research+OR+report+OR+children+OR+social+media)&hl=en-AU&gl=AU&ceid=AU:en',
    relevance: ['research', 'children', 'social media', 'transparency', 'youth', 'minor', 'underage', 'platform', 'safety']
  },
  {
    id: 'aihw-news',
    name: 'AIHW Health & Welfare (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:aihw.gov.au+(mental+health+OR+youth+OR+children+OR+wellbeing)&hl=en-AU&gl=AU&ceid=AU:en',
    relevance: ['mental health', 'youth', 'children', 'social media', 'wellbeing', 'self-harm', 'adolescent', 'young', 'teen']
  },
  {
    id: 'abs-news',
    name: 'ABS Statistics (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:abs.gov.au+(mental+health+OR+wellbeing+OR+youth)&hl=en-AU&gl=AU&ceid=AU:en',
    relevance: ['mental health', 'wellbeing', 'youth', 'children', 'survey', 'statistics']
  },
  {
    id: 'pubmed-research',
    name: 'PubMed — Australian Youth Social Media Research',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=%22social+media%22+AND+%28australia+OR+australian%29+AND+%28youth+OR+adolescent+OR+children%29+AND+%28mental+health+OR+depression+OR+anxiety%29&filter=datesearch.y_1&format=rss',
    relevance: ['social media', 'australia', 'australian', 'youth', 'adolescent', 'children', 'mental', 'depression', 'anxiety']
  },
  {
    id: 'general-research',
    name: 'Australian Youth Social Media Research (Google News)',
    url: 'https://news.google.com/rss/search?q=%22social+media%22+%22australia%22+(children+OR+youth+OR+teenagers)+(mental+health+OR+algorithm+OR+research+OR+study)&hl=en-AU&gl=AU&ceid=AU:en',
    relevance: ['social media', 'australia', 'children', 'youth', 'teen', 'mental', 'research', 'study', 'algorithm', 'platform', 'tiktok', 'instagram', 'snapchat']
  },
  {
    id: 'lancet-news',
    name: 'Lancet Digital Health Coverage (Google News)',
    url: 'https://news.google.com/rss/search?q=%22Lancet+Digital+Health%22+(social+media+OR+children+OR+youth+OR+australia)&hl=en-AU&gl=AU&ceid=AU:en',
    relevance: ['social media', 'children', 'youth', 'australia', 'mental', 'platform']
  }
];

// ── HELPERS ────────────────────────────────────────────────────────

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SafeScrollMonitor/2.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function parseRSS(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ||
                 xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];

  for (const block of blocks) {
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) ||
                  block.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ||
                     block.match(/<published>([\s\S]*?)<\/published>/) ||
                     block.match(/<updated>([\s\S]*?)<\/updated>/) ||
                     block.match(/<dc:date>([\s\S]*?)<\/dc:date>/) || [])[1] || '';
    const description = (block.match(/<description[^>]*>([\s\S]*?)<\/description>/) ||
                         block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) ||
                         block.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '';

    const clean = (s) => s
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();

    if (title && link) {
      items.push({
        title: clean(title),
        link: clean(link),
        pubDate: clean(pubDate),
        description: clean(description).substring(0, 280)
      });
    }
  }
  return items;
}

function isRelevant(item, keywords) {
  if (!keywords.length) return true;
  const text = (item.title + ' ' + item.description).toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

// ── STATE MANAGEMENT ───────────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {}
  return { sources: {}, lastRun: null, runCount: 0 };
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
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({ title, body, labels })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Issue creation failed: ${res.status} ${errText}`);
  }
  return await res.json();
}

// ── MAIN ───────────────────────────────────────────────────────────

(async () => {
  console.log('🔍 SafeScroll Source Monitor v2 — starting check...\n');
  const state = loadState();
  const isFirstRun = !state.runCount || state.runCount === 0;
  const allNewItems = [];
  const sourceStats = [];

  for (const src of SOURCES) {
    console.log(`Checking: ${src.name}`);
    try {
      const content = await fetchUrl(src.url);
      const items = parseRSS(content);
      const relevant = items.filter(item => isRelevant(item, src.relevance));
      console.log(`  ✓ Found ${items.length} items (${relevant.length} relevant)`);
      sourceStats.push({ name: src.name, total: items.length, relevant: relevant.length, ok: true });

      const knownLinks = new Set((state.sources[src.id]?.knownLinks) || []);
      const newItems = isFirstRun
        ? relevant.slice(0, 5)
        : relevant.filter(item => !knownLinks.has(item.link));

      if (newItems.length > 0) {
        console.log(`  🆕 ${newItems.length} ${isFirstRun ? 'recent' : 'new'} items to report`);
        allNewItems.push({ source: src, items: newItems });
      }

      const merged = [...new Set([...relevant.map(i => i.link), ...Array.from(knownLinks)])].slice(0, 150);
      state.sources[src.id] = {
        knownLinks: merged,
        lastChecked: new Date().toISOString(),
        lastFoundCount: items.length
      };

    } catch (err) {
      console.log(`  ⚠️ Error: ${err.message}`);
      sourceStats.push({ name: src.name, ok: false, error: err.message });
    }
  }

  state.lastRun = new Date().toISOString();
  state.runCount = (state.runCount || 0) + 1;
  saveState(state);

  if (allNewItems.length === 0 && !isFirstRun) {
    console.log('\n✓ No new relevant content found.');
    return;
  }

  // Build issue
  let totalNew = 0;
  let body = '';

  if (isFirstRun) {
    body += `## 🚀 SafeScroll Source Monitor — Initial Setup Complete!\n\n`;
    body += `Your automated source monitor is now active. This is the **initial run**, showing the **5 most recent items** from each source as a preview.\n\n`;
    body += `From next Monday onward, you will only receive alerts about **genuinely new** items the monitor has not previously seen. No spam.\n\n`;
  } else {
    body += `## 📊 Weekly Data Source Monitor — New Content Detected\n\n`;
    body += `Your automated monitor found new publications relevant to SafeScroll Australia.\n\n`;
  }

  body += `**Run date:** ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} (Sydney)\n`;
  body += `**Run number:** #${state.runCount}\n\n---\n\n`;

  body += `### Source Health\n\n`;
  body += `| Source | Status | Items |\n|---|---|---|\n`;
  for (const s of sourceStats) {
    if (s.ok) body += `| ${s.name} | ✅ OK | ${s.total} (${s.relevant} relevant) |\n`;
    else body += `| ${s.name} | ⚠️ Error | ${s.error} |\n`;
  }
  body += `\n---\n\n`;

  if (allNewItems.length > 0) {
    body += `### 📌 ${isFirstRun ? 'Recent Items (Preview)' : 'New Items'}\n\n`;
    for (const { source, items } of allNewItems) {
      body += `#### ${source.name}\n\n`;
      for (const item of items.slice(0, 8)) {
        totalNew++;
        body += `- **[${item.title}](${item.link})**\n`;
        if (item.pubDate) body += `  📅 ${item.pubDate}\n`;
        if (item.description) {
          const desc = item.description.length > 200 ? item.description.substring(0, 200) + '...' : item.description;
          body += `  ${desc}\n`;
        }
        body += `\n`;
      }
    }
  }

  body += `---\n\n## ✅ Action Checklist\n\n`;
  body += `- [ ] Review each link above for relevance to SafeScroll\n`;
  body += `- [ ] Update outdated statistics in \`index.html\` (use Ctrl+F)\n`;
  body += `- [ ] Update matching entries in your Cloudflare Worker \`SYSTEM_PROMPT\`\n`;
  body += `- [ ] Update the **"Data last reviewed"** badge in the hero section\n`;
  body += `- [ ] If a major new finding emerges, consider adding a new Findings card\n`;
  body += `- [ ] Close this issue when review is complete\n\n---\n\n`;
  body += `*Auto-created by \`.github/workflows/monitor-sources.yml\`*\n`;
  body += `*Manual run: Actions → SafeScroll Data Source Monitor → Run workflow*\n`;
  body += `*Disable: Actions → SafeScroll Data Source Monitor → "..." → Disable*\n`;

  const title = isFirstRun
    ? `🚀 Source Monitor Active — Initial Preview (${new Date().toISOString().slice(0,10)})`
    : `📊 Source Update — ${totalNew} new item${totalNew === 1 ? '' : 's'} (${new Date().toISOString().slice(0,10)})`;

  await createIssue(title, body, ['data-update', 'automated']);
  console.log(`\n✅ Issue created with ${totalNew} items.`);

})().catch(err => {
  console.error('❌ Monitor failed:', err);
  process.exit(1);
});
