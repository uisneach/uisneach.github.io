// .github/fetch_feeds.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

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
    const results = await Promise.all(
      data.feeds.map(async (url) => {
        try {
          const response = await fetch(url, {
			  headers: {
			    'User-Agent': 'MyRSSFetcher/1.0 (+https://github.com/myorg)'
			  }
			});
          if (!response.ok) {
          	console.log({ status: response.status, headers: [...response.headers] });
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const body = await response.text();
          return { url, content: body };
        } catch (error) {
          return { url, error: error.message };
        }
      })
    );

    console.log(results);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();
