# SafeScroll Australia — Automated Source Monitor Setup

This sets up free, fully automated weekly monitoring of all your data sources.
When new research or government data is published, you'll receive an email
with a checklist of what to update.

**Total setup time:** 5 minutes
**Total cost:** $0 forever

---

## What This Does

Every Monday morning at 9 AM Sydney time, GitHub will automatically:

1. Check the eSafety Commissioner newsroom for new publications
2. Check AIHW for new health and welfare reports
3. Check PubMed for new peer-reviewed papers matching SafeScroll's research scope
4. Check the ABS Mental Health page for content changes
5. **If anything new and relevant is found → automatically creates an Issue in your repo**
6. **GitHub emails you the issue automatically** (you'll already get this since you own the repo)

If nothing new is found, nothing happens — no spam.

---

## Step 1 — Add the Files to Your Repository

You need to upload **two files** in a specific folder structure. The folder structure matters.

### Option A: Upload via GitHub Web UI (easier)

1. Go to your repository: `https://github.com/ai-ati/safescroll-australia`
2. Click **"Add file"** → **"Create new file"**
3. In the filename box, type exactly:
   ```
   .github/workflows/monitor-sources.yml
   ```
   (the slashes will create the folders automatically)
4. Open the `monitor-sources.yml` file I provided you
5. **Copy its entire contents**
6. **Paste** into the GitHub editor
7. Scroll down → **"Commit changes"**

Now repeat for the second file:

8. Click **"Add file"** → **"Create new file"**
9. Filename:
   ```
   .github/scripts/monitor-sources.js
   ```
10. Copy the contents of `monitor-sources.js`
11. Paste in
12. Commit changes

### Option B: Upload via Drag-and-Drop

1. Make a folder structure on your computer:
   ```
   .github/
     workflows/
       monitor-sources.yml
     scripts/
       monitor-sources.js
   ```
2. Drag the entire `.github` folder into your repository's "Add file → Upload files" dialog
3. Commit changes

---

## Step 2 — Enable GitHub Actions Permissions

This is required so the workflow can create issues automatically.

1. In your repository, click **Settings** (top menu)
2. In the left sidebar, click **Actions** → **General**
3. Scroll down to **"Workflow permissions"**
4. Select **"Read and write permissions"**
5. Tick **"Allow GitHub Actions to create and approve pull requests"**
6. Click **Save**

---

## Step 3 — Test It Right Now

Don't wait until next Monday — verify it works immediately:

1. Go to the **Actions** tab of your repository
2. You should see **"SafeScroll Data Source Monitor"** in the left sidebar
3. Click on it
4. Click **"Run workflow"** button (right side) → **"Run workflow"** (green button)
5. Wait ~30 seconds and refresh the page
6. You'll see a yellow circle (running) → green tick (success) or red X (failed)
7. Click on the run to see the live log

**On the first run**, the script has no "known items" stored, so it may flag everything as new. **This is expected.** From the second run onwards, it only flags genuinely new items.

---

## Step 4 — Verify the Email Notification

After the workflow completes successfully:

1. Go to the **Issues** tab
2. You should see a new issue titled something like `📊 Source Update — N new items (2026-XX-XX)`
3. Open it — it lists every new publication with links and a checklist
4. **GitHub will have emailed this to your account email** automatically (you may need to check your GitHub notification settings)

To make sure email notifications are on:
1. Click your profile picture (top-right of GitHub) → **Settings**
2. Click **Notifications** in the left sidebar
3. Under **"Email notification preferences"** make sure your email is verified
4. Under **"Watching"** ensure **"Notify me when..."** is set to receive issue notifications

---

## Step 5 — Customising (Optional)

### Change the schedule
Open `.github/workflows/monitor-sources.yml` and edit the `cron` line.
Examples:
```yaml
- cron: '0 22 * * 0'    # Mondays 9 AM Sydney (default)
- cron: '0 22 * * 1,4'  # Mondays AND Thursdays
- cron: '0 22 1 * *'    # First day of every month only
```

### Add or remove sources
Open `.github/scripts/monitor-sources.js` and edit the `SOURCES` array near the top.

### Change relevance keywords
Edit the `relevance` array for each source. The script only alerts if at least one keyword matches the title or description.

### Manual run anytime
Actions tab → SafeScroll Data Source Monitor → Run workflow

---

## What You'll Receive

Every Monday morning when something new is published, you'll get a GitHub email with:

- **Subject:** `📊 Source Update — 3 new items (2026-04-15)`
- **Body:** A clean list of every new publication, organised by source, with:
  - Title and direct link
  - Publication date
  - Brief description
  - Action checklist for updating the site and AI Worker

You can mark the checklist items as complete, then close the issue once you've reviewed everything.

---

## Troubleshooting

**Workflow fails with "Resource not accessible by integration"**
→ Permissions weren't set correctly in Step 2. Go back and enable read/write permissions.

**No issue is created even though new content exists**
→ Check Actions tab → click the failed run → read the log. Usually a network or RSS parsing issue with one source. The monitor continues with other sources even if one fails.

**Too many irrelevant items being flagged**
→ Tighten the `relevance` keywords in `monitor-sources.js`. More specific keywords = fewer false positives.

**Want to stop receiving alerts**
→ Actions tab → SafeScroll Data Source Monitor → click the **"…"** menu → Disable workflow.
You can re-enable anytime.

---

## How This Compares to RSS Readers

| Feature | This (GitHub Actions) | Inoreader/Feedly |
|---------|----------------------|------------------|
| Setup time | 5 mins | 15+ mins |
| Tracks already-seen items automatically | ✅ Yes | ❌ Manual |
| Action-oriented checklist | ✅ Yes | ❌ Just headlines |
| Free forever | ✅ Yes | ✅ Yes |
| Filters by relevance | ✅ Built-in | ⚠️ Limited |
| History/audit trail | ✅ In your repo | ⚠️ In email |
| Can trigger manually | ✅ Yes | ❌ No |

---

*Setup complete — you're now running an automated research awareness pipeline that costs nothing and requires zero ongoing maintenance.*
