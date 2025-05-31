const RSSParser = require('rss-parser');
const parser = new RSSParser();
const cheerio = require('cheerio');

// Helper to test image URLs
function isImageUrl(u) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(u);
}

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

hexo.extend.generator.register('rss-feed', async function () {
  // List of RSS feed URLs
  const RSSfeeds = hexo.config.external_feeds || [];
  const allItems = [];

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Fetch and aggregate feed items
  for (const url of RSSfeeds) {
    try {
      const feed = await parser.parseURL(url);

      // Inject the channel-level image url into each item
      const channelImageURL = feed.image?.url || '';
      feed.items.forEach(item => {
        const enclosureUrl = item.enclosure?.url;
        const postDomain = (new URL(item.link)).hostname.replace(/^www\./, '');

        if (Object.prototype.hasOwnProperty.call(bannerExtractors, postDomain)) {
          const extractor = bannerExtractors[postDomain];
          item = extractor(item);
        }

        if (!item.bannerImage) {
          if (enclosureUrl && isImageUrl(enclosureUrl)) {
            item.bannerImage = enclosureUrl;
          } else {
            item.bannerImage = channelImageURL;
          }
        }

        // Encode channel title into each item
        item.channelTitle = feed.title;
        item.channelLink = feed.link;
      });

      console.log("Successfully fetched RSS feed from " + feed.title);

      allItems.push(...feed.items);
    } catch (err) {
      console.error(`Failed to fetch RSS feed from ${url}:`, err);
    }

    // Introduce a delay between each fetch
    await delay(300);
  }

  // Sort items by publication date (most recent first)
  allItems.sort((a, b) => {
    const dateA = new Date(a.isoDate || a.pubDate || 0);
    const dateB = new Date(b.isoDate || b.pubDate || 0);
    return dateB - dateA;
  });

  // Return the page data with specified layout
  return {
    path: 'read/index.html',
    layout: ['rss-feed', 'page', 'index'], // Fallback to 'page' or 'index' if 'rss-feed' doesn't exist
    data: {
      title: 'Latest Posts',
      externalFeeds: allItems
    }
  };
});