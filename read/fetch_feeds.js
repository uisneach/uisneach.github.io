const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const yaml = require('js-yaml');

const parser = new Parser();

async function fetchFeeds() {
  const feedsYaml = fs.readFileSync('feeds.yaml', 'utf8');
  const feedList = [
    'https://uisneac.com/rss.xml',
    'https://thedorianinvasion.substack.com/feed',
    'https://amphora.substack.com/feed',
    'https://www.arthwys.com/feed',
    'https://bronzeagepervert.substack.com/feed',
    'http://www.stoneageherbalist.com/feed',
    'https://lanceslegion.substack.com/feed',
    'https://ormulus.substack.com/feed',
    'https://cartographer.substack.com/feed',
    'https://spergler.substack.com/feed',
    'https://ghostofdemaistre.substack.com/feed',
    'https://chadcrowley.substack.com/feed',
    'http://www.theconundrumcluster.com/feed',
    'https://classicagevitalist.substack.com/feed',
    'https://hyperpoiesis.substack.com/feed',
    'https://theamericansun.substack.com/feed',
    'https://www.theburkean.ie/feed',
    'https://mansworldmag.online/feed/',
    'https://putonthemask.substack.com/feed',
    'https://montanaclassicalcollege.substack.com/feed',
    'https://scythianbro.substack.com/feed'
  ];

  let allItems = [];

  for (const feedUrl of feedList) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.content,
        contentSnippet: item.contentSnippet,
        isoDate: item.isoDate,
        source: feed.title
      }));
      allItems = allItems.concat(items);
    } catch (error) {
      console.error(`Error fetching ${feedUrl}:`, error);
    }
  }

  // Sort items by publication date (descending)
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Ensure the feeds directory exists
  const outputDir = path.join(__dirname, '');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Write the aggregated feed to a JSON file
  fs.writeFileSync(
    path.join(outputDir, 'combined.json'),
    JSON.stringify(allItems, null, 2)
  );
}

fetchFeeds();
