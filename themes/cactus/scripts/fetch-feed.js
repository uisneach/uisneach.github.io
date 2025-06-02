const fs = require('fs');
const path = require('path');
const RSSParser = require('rss-parser');
const parser = new RSSParser();
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');
const { DOMParser } = require('xmldom');

// Helper to test image URLs
function isImageUrl(u) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic)$/i.test(u);
}

const dbPath = path.join(hexo.base_dir, 'source/read/', 'feeds_db.json');

// In the case that a blog's post banner images are not encoded in a predictable place, this
// will allow you to define a specialty function for any url's feed. You can find the image
// manually, either in the feed or on the website, and point the renderer to that location.
const bannerExtractors = {
  'mansworldmag.online': function (item) {
    if (!item['content:encoded']) return item;

    const $ = cheerio.load(item['content:encoded']);

    // Extract author from "Essay by Author Name | ..." in description
    const authorMatch = item.contentSnippet?.match(/^(Essay|Fiction|Poem)\s+by\s+([^|]+)(?:\s*\|)?/i);
    if (authorMatch) {
      item.creator = authorMatch[2].trim();
      item.author = authorMatch[2].trim();
      item['dc:creator'] = authorMatch[2].trim();

      // Remove "Essay by Author Name | ..." from the article snippet.
      item.contentSnippet = item.contentSnippet.replace(authorMatch[0], '').trim();
    }

    // Clean up "The post ... appeared first on ..." from contentSnippet
    if (item.contentSnippet) {
      item.contentSnippet = item.contentSnippet.replace(/(The|This) post .*?https?:\/\/\S+\.*$/i, '').trim();
    }

    // Set banner image
    const image = $('img[src*="mansworldmag.online/wp-content/uploads/"]').first();
    item.bannerImage = image.attr('src') || '';

    return item;
  },

  'theburkean.ie': function (item) {
    try {
      const res = require('sync-request')('GET', item.link);
      const $ = cheerio.load(res.getBody());

      const bgStyle = $('div.site-header-bg').attr('style') || '';
      const match = bgStyle.match(/url\((.*?)\)/);

      item.bannerImage = match ? match[1].replace(/&amp;/g, '&') : '';
    } catch (err) {
      console.error(`Failed to extract banner from theburkean.ie: ${item.link}`, err);
    }
    return item;
  }
};

// This helper function will fetch the RSS feed from its remote source, parse it as XML,
// and convert it to a JSON.
async function fetchAndConvertRSS(url) {
  try {
    // 1) Fetch the RSS XML as text
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const xmlText = await response.text();

    // 2) Parse the XML string into a JS object
    const xmlOptions = {
      explicitArray: false,     // Put single items directly instead of an array
      mergeAttrs: true,         // Merge attributes onto the same level as child elements
      explicitCharkey: false,   // Don’t put text under a separate “_” key
      trim: true                // Trim whitespace from text nodes
    };
    const parsed = await parseStringPromise(xmlText, xmlOptions);

    // 3) Now we have a JS object that mirrors the full RSS structure:
    //    parsed.rss.channel → channel‐level metadata
    //    parsed.rss.channel.item  → array (or single object) of items
    // console.log('Parsed RSS object:', parsed);

    // Return the full JS object so we can manipulate it downstream
    return parsed;
  } catch (error) {
    console.error('Error fetching or parsing RSS:', error);
    throw error;
  }
}


function channelExists(db, channelLink) {
  return db.some(channel => channel.link === channelLink);
}

function postExists(db, channelLink, postKey) {
  const channel = db.find(ch => ch.link === channelLink);
  if (!channel || !Array.isArray(channel.item)) return false;

  return channel.item.some(item => {
    // Check both guid and link fields for a match
    if (item.guid && item.guid === postKey) return true;
    if (item.link && item.link === postKey) return true;
    return false;
  });
}

hexo.extend.generator.register('rss-feed', async function () {
  // Hexo sets hexo.env.command to 'server' or 'generate', etc.
  if (hexo.env.command === 'server') {
    hexo.log.info('[rss_feed] Skipping feed fetch in server mode');
    return;
  }

  // List of RSS feed URLs
  const RSSfeeds = hexo.config.external_feeds || [];

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Load existing database (or initialize it)
  let dbData = [];
  if (fs.existsSync(dbPath)) {
    try {
      hexo.log.info('Checking for RSS feed database...');
      const raw = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        hexo.log.warn('[rss_feed] feeds_db.json exists but is not an array. Reinitializing.');
        dbData = [];
      } else {
      // Validate each channel object against the desired schema
      const malformedChannel = parsed.find(channel => {
        return (
          typeof channel !== 'object' ||
          typeof channel.link   !== 'string' ||
          typeof channel.title  !== 'string' ||
          typeof channel.description   !== 'string' ||
          !Array.isArray(channel.item)
        );
      });

      if (malformedChannel) {
        hexo.log.warn('[rss_feed] feeds_db.json has an entry that does not match the expected channel schema. Reinitializing.');
        dbData = [];
      } else {
          // Validate each item within each channel
          parsed.forEach(channel => {
            channel.item = channel.item.filter(item => {
              // An item must be an object and have at least a `link` or a `guid` string
              return (
                item && 
                typeof item === 'object' && 
                (typeof item.link === 'string' || typeof item.guid === 'string')
              );
            });
          });

          // All checks passed
          dbData = parsed;
        }
      }
    } catch (err) {
      hexo.log.warn(`[rss_feed] Could not parse feeds_db.json (will overwrite): ${err.message}`);
      dbData = [];
    }
  } else {
    // If file doesn’t exist, ensure the parent directory exists, then write an initial empty array
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify([], null, 2), 'utf8');
      hexo.log.info('[rss_feed] Created new feeds_db.json (empty array).');
    } catch (err) {
      hexo.log.error(`[rss_feed] Failed to create feeds_db.json: ${err.message}`);
      return []; // Without a place to store results, bail out
    }
  }

  // Helper: find a channel entry in dbData by its channelLink
  function findChannel(channelLink) {
    return dbData.find(ch => ch.link === channelLink);
  }

  function findPostInChannel(channelLink, postLink) {
    const channel = dbData.find(ch => ch.link === channelLink);
    if (!channel || !Array.isArray(channel.item)) return null;

    return channel.item.find(item => item.link === postLink);
  }

  // Fetch and aggregate feed items
  for (const url of RSSfeeds) {
    try {
      hexo.log.info(`[rss_feed] Fetching: ${url}`);

      const feed = await fetchAndConvertRSS(url);
      const channel = feed.rss?.channel;
      const posts = Array.isArray(channel.item) ? channel.item : [channel.item];

      // Deduplicate
      if (!channelExists(dbData, channel.link)) {
        // Channel does not exist in database
        dbData.push(channel);
        hexo.log.info(`  ↳ Added: ${channel.title}`);
      } else {
        // Channel exists, now we must deduplicate each post.
        posts.forEach(fetchedPost => {
          const dbPosts = findChannel(channel.link).item;
          const postExists = dbPosts.some(dbPost => (((fetchedPost.guid && dbPost.guid) && fetchedPost.guid === dbPost.guid) || (fetchedPost.link === dbPost.link)));
          if (!postExists) {
            // If post doesn't exist, add it.
            dbPosts.push(fetchedPost);
            hexo.log.info(`  ↳ Added: ${fetchedPost.title} to ${dbChannel.title}`);
          }
        });
      }

      // Extract a banner image for each post.
      findChannel(channel.link).item.forEach(post => {
        if (!post.bannerImage) {
          const postDomain = (new URL(post.link)).hostname.replace(/^www\./, '');
          if (Object.prototype.hasOwnProperty.call(bannerExtractors, postDomain)) {
            const extractor = bannerExtractors[postDomain];
            post = extractor(post);
          }

          const enclosureUrl = post.enclosure?.url;
          if (enclosureUrl && isImageUrl(enclosureUrl)) {
            post.bannerImage = enclosureUrl;
          } else {
            post.bannerImage = channel.image?.url;
          }
        }
      });

      hexo.log.info("[rss_feed] Successfully fetched RSS feed from " + channel.title);
    } catch (err) {
      hexo.log.error(`[rss_feed] Failed to fetch RSS feed from ${url}:`, err);
    }

    // Introduce a delay between each fetch
    await delay(300);
  }

  // Write updated database back to feeds_db.json if any changes were made
  const oldContent = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf8') : null;
  const newContent = JSON.stringify(dbData, null, 2);

  if (newContent !== oldContent) {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
      hexo.log.info(`[rss_feed] feeds_db.json updated (${dbData.length} items total)`);
    } catch (err) {
      hexo.log.error(`[rss_feed] Error writing feeds_db.json: ${err.message}`);
    }
  }

  // Return the page data with specified layout
  return {
    path: 'read/index.html',
    layout: ['rss-feed', 'page', 'index'], // Fallback to 'page' or 'index' if 'rss-feed' doesn't exist
    data: {
      title: 'Latest Posts',
      externalFeeds: dbData
    }
  };
});