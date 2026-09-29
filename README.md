# SafeScroll Australia

**Algorithmic content exposure and mental-health trajectories of young social media users in Australia.**

An independent, community-run site tracking how social media algorithms affect Australian children
and young people, using government, statutory and academic sources only.

## What's on the site

- **Platform Risk Index**: scores for TikTok, Instagram, Snapchat, YouTube, Discord and Facebook across evidence-based harm dimensions
- **Australian data**: eSafety, ABS and AIHW statistics, charted
- **Evidence summaries**: key research findings
- **Risk calculator**: a personalised estimate for a child's use, with recommendations
- **Ask the data**: an AI assistant (Cloudflare Worker) grounded in `data.json`
- **Resources**: for parents, educators, researchers and young people

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole site (single page) |
| `data.json` | **Single source of truth** for scores, statistics, legislation and crisis lines. The site loads it at runtime and the AI Worker reads it too. Values built into `index.html` are only an offline fallback. |
| `.github/workflows/monitor-sources.yml` | Weekly GitHub Action that checks eSafety, AIHW, ABS and PubMed for new publications |
| `.github/scripts/monitor-sources.js` | Script run by that Action; opens an Issue when something new appears |
| `SafeScroll_Source_Monitor_Setup.md` | How the monitor works |

## Updating data

Edit `data.json` (see its `_README` block for the rules), update `_meta.lastReviewed` and
`_meta.nextReview`, then commit. The "Data last reviewed" date, the platform cards, and the
headline stats on the site update automatically.

## Crisis support (Australia)

Lifeline 13 11 14 · Kids Helpline 1800 55 1800 · Beyond Blue 1300 22 4636 · [headspace](https://headspace.org.au)
