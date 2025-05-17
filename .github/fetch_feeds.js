// .github/fetch_feeds.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log("✅ GitHub Action executed: fetch_feeds.js v4 is running!");

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

    const firstUrl = data.feeds[3];
    console.log(`🌐 Fetching: ${firstUrl}`);

    // Perform HTTP GET request
    const response = await fetch(firstUrl);

    // Check if the response is OK (status code 200-299)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Read and print the response body as text
    const body = await response.text();
    console.log("📄 Response body:");
    console.log(body);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();
