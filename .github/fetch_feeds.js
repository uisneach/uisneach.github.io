// .github/fetch_feeds.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { mkdirSync, writeFileSync, readFileSync } = fs;

console.log("GitHub Action executed: fetch_feeds.js v5 is running!");

(async () => {
  try {
    // 1. Load feeds.yml
    const feedsPath = path.join(__dirname, 'feeds.yml');
    const fileContents = readFileSync(feedsPath, 'utf8');
    const config = yaml.load(fileContents);
    if (!config || !Array.isArray(config.feeds) || config.feeds.length === 0) {
      throw new Error("feeds.yml must contain a non-empty 'feeds' array");
    }

    // 2. Fetch every URL in parallel
    console.log(`Fetching ${config.feeds.length} feeds...`);
    const fetches = config.feeds.map(async url => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const text = await res.text();
        console.log(`✔️  Fetched ${url}`);
        return { url, content: text };
      } catch (err) {
        console.error(`Failed ${url}: ${err.message}`);
        return { url, error: err.message };
      }
    });
    const results = await Promise.all(fetches);

    // 3. Assemble into an object
    const output = results.reduce((acc, { url, content, error }) => {
      acc[url] = error ? { error } : { body: content };
      return acc;
    }, {});

    // 4. Write to gh-pages/read/rss.json
    //    Assumes your workflow has checked out gh-pages into ./gh-pages
    const outDir = path.join(process.cwd(), 'gh-pages', 'read');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'rss.json');
    writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Wrote all feeds JSON to ${outPath}`);

  } catch (err) {
    console.error("Error in fetch_feeds.js:", err.message);
    process.exit(1);
  }
})();
