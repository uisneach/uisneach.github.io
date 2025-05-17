// .github/fetch_feeds.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log("✅ GitHub Action executed: fetch_feeds.js is running!");

(async () => {
  try {
    // Construct the path to feeds.yml
    const feedsPath = path.join(__dirname, 'feeds.yml');

    // Read and parse feeds.yml
    const fileContents = fs.readFileSync(feedsPath, 'utf8');
    const data = yaml.load(fileContents);

    // Validate the feeds array
    if (!data || !Array.isArray(data.feeds) || data.feeds.length === 0) {
      console.error("❌ feeds.yml does not contain a valid 'feeds' array.");
      process.exit(1);
    }

    // Fetch the contents of all URLs
    const fetch = require('node-fetch'); // Ensure node-fetch is installed
    const results = await Promise.all(
      data.feeds.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const body = await response.text();
          return { url, content: body };
        } catch (error) {
          return { url, error: error.message };
        }
      })
    );

    // Prepare the output directory and file path
    const outputDir = path.join(process.cwd(), 'gh-pages', 'read');
    const outputPath = path.join(outputDir, 'rss.json');

    // Create the directory if it doesn't exist
    fs.mkdirSync(outputDir, { recursive: true });

    // Write the results to rss.json
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`📄 rss.json has been created at ${outputPath}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();