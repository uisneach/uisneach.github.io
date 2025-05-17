// .github/fetch_feeds.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log("✅ GitHub Action executed: fetch_feeds.js is running!");

try {
  // Construct the path to the feeds.yml file
  const feedsPath = path.join(__dirname, 'feeds.yml');

  // Read the YAML file
  const fileContents = fs.readFileSync(feedsPath, 'utf8');

  // Parse the YAML content
  const data = yaml.load(fileContents);

  // Output the parsed data to the console
  console.log("📄 Contents of feeds.yml:");
  console.dir(data, { depth: null });
} catch (error) {
  console.error("❌ Error reading feeds.yml:", error.message);
  process.exit(1);
}
