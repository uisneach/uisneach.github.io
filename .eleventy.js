const EleventyFetch = require("@11ty/eleventy-fetch");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const fs = require("fs-extra");
const path = require("path");
const footnote = require("markdown-it-footnote");
const markdownIt = require("markdown-it");
const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
});

// For Substack RSS parsing
const Parser = require('rss-parser');
const parser = new Parser();
require('dotenv').config();

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "source/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "source/css": "css" });
  eleventyConfig.addPassthroughCopy({ "source/scripts": "scripts" });
  eleventyConfig.addPassthroughCopy({ "source/.well-known": ".well-known" });

  // Ignore folders
  eleventyConfig.ignores.add("source/_drafts");

  // Modify markdown engine to allow regular md footnotes
  eleventyConfig.amendLibrary("md", mdLib => {
    mdLib.use(footnote);

    // Customize in-text footnote references: superscript number without brackets
    mdLib.renderer.rules.footnote_ref = (tokens, idx, options, env, slf) => {
      const id = tokens[idx].meta.id + 1; // 1-based index
      return `<sup class="footnote-ref" id="fnref${id}"><a href="#fn${id}" rel="footnote">${id}</a></sup>`;
    };

    // Customize the bottom footnote block: ensure numbered list
    // (This is mostly default, but we can tweak classes or add wrappers if needed)
    mdLib.renderer.rules.footnote_block = (tokens, idx, options, env, slf) => {
      let html = '<hr class="footnotes-sep">\n<section class="footnotes">\n<ol class="footnotes-list">\n';
      for (let i = 0; i < tokens[idx].children.length; i++) {
        const token = tokens[idx].children[i];
        if (token.type === 'footnote_open') {
          const id = token.meta.id + 1;
          html += `<li id="fn:${id}" class="footnote-item">`;
        } else if (token.type === 'footnote_close') {
          html += '</li>\n';
        } else if (token.type === 'inline') {
          html += slf.renderInline(token.children, options, env);
        }
      }
      html += '</ol>\n</section>';
      return html;
    };
  });

  // Filters to render any text as markdown
  eleventyConfig.addFilter("markdown", function (content) {
    return md.render(content);
  });

  // Collect posts together
  eleventyConfig.addCollection("posts", function(collectionAPI) {
    return collectionAPI.getFilteredByGlob("source/posts/*.md").sort((a, b) => b.date - a.date);
  });

  // Helper filter for the posts.njk page
  eleventyConfig.addFilter('extractFirstImageUrl', function (content) {
    if (!content) return null;

    const $ = cheerio.load(content, { xmlMode: true });
    const firstImg = $('img').first();

    if (firstImg.length) {
      let src = firstImg.attr('src');
      // Handle relative paths (common in Eleventy)
      if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
        // You can prepend your image base path if needed, e.g.:
        // src = '/images/' + src.replace(/^\//, '');
        // But usually Eleventy's | url filter handles it later
      }
      return src;
    }

    return null;
  });

  eleventyConfig.addPairedShortcode("blockquote", function(content, attribution) {
    // Trim outer whitespace but preserve internal newlines
    const trimmedContent = content.trim();
    // Replace newlines with <br> for line breaks
    const processedContent = md.render(trimmedContent);
    const cite = attribution ? `<cite class="blockquote-attribution">${attribution}</cite>` : '';
    return `<div class="blockquote-content flex-column"><blockquote>${processedContent}</blockquote>${cite}</div>`;
  });

  eleventyConfig.addShortcode("image", function(path, caption, altText) {
    let fullSrc;
    const isExternal = /^https?:\/\//i.test(path);

    if (isExternal) {
      fullSrc = path;
    } else {
      // Local path: prepend /assets/
      const cleanPath = path.replace(/^\.?\//, '');
      fullSrc = `/assets/${cleanPath}`;
    }

    // Use caption as alt text (good for accessibility)
    if (!altText)
      altText = caption || path.split('/').pop();

    return `
      <figure>
        <img src="${fullSrc}" alt="${altText}">
        ${caption ? `<figcaption>${caption}</figcaption>` : ''}
      </figure>
    `;
  });

  eleventyConfig.addPairedShortcode("bilingual", function(content, ...args) {
    // Parse the parameters (e.g., {% bilingual color="red" %})
    const params = {};
    args.forEach(arg => {
      const [key, value] = arg.split('=');
      if (key && value) {
        params[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Strip quotes if present
      }
    });

    const color = params.color || 'rgb(201, 202, 204)';

    const paragraphDelimiter = '-^-';
    const generalDelimiter = '-&-'; // Fixed typo from original

    // Manually create emphasis and italicization in the content text
    content = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');

    // Split the content into two parts using the delimiter '-&-'
    const parts = content.split(generalDelimiter);
    if (parts.length !== 2) {
      return 'Invalid content format. Please separate the two blocks of text with "' + generalDelimiter + '".';
    }

    const text1 = parts[0].trim();
    const text2 = parts[1].trim();

    const lines1 = text1.replace(/\n\n/g, '\n-^-\n').split('\n').filter(line => line.trim() !== '');
    const lines2 = text2.replace(/\n\n/g, '\n-^-\n').split('\n').filter(line => line.trim() !== '');

    const title1 = lines1.length > 0 ? lines1.shift() : '';
    const title2 = lines2.length > 0 ? lines2.shift() : '';

    let table = '<thead><tr><th>' + title1 + '</th><th>' + title2 + '</th></tr></thead><tbody>';

    for (let i = 0; i < Math.max(lines1.length, lines2.length); i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      // Check for paragraph delimiter in text
      if (line1.includes(paragraphDelimiter) || line2.includes(paragraphDelimiter)) {
        table += '<tr><td colspan="2"><br></td></tr>'; // Adjusted for full-width blank row
      } else {
        // Escape * and _ to prevent further Markdown processing if needed
        table += `<tr><td style="padding-right: 10px;">${line1.replace(/([*_])/g, '\\$1')}</td><td>${line2.replace(/([*_])/g, '\\$1')}</td></tr>`;
      }
    }

    table += '</tbody>';

    return `<table class="bilingual-table" style="color:${color};">${table}</table>`;
  });

  // Subst*ck processing function
  // Take in a URL to a substack post. Because S*bstack doesn't expose their API, we have to follow this
  // circuitous route: 1) get post URL, 2) extract publication name (i.e. publication.substack.com),
  // 3) query the publicly-exposed RSS feed for this publication, 4) match the desired post URL with the
  // corresponding RSS feed item, and 5) extract post metadata from the RSS feed. Return metadata.
  async function getSubstackMetadataByRSS(url) {
    // Extract publication name
    // E.g. 'uisneac.substack.com' -> 'uisneac'
    let feedUrl;
    try {
      const parsedUrl = new URL(url);
      feedUrl = `https://${parsedUrl.origin}/feed`;
    } catch (error) {
      console.error(`Error parsing URL ${url}: ${error.message}`);
      return null;
    }

    try {
      // Use RSS parser to query publication RSS feed
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items || [];

      // Try to match by link (with and without trailing slash)
      let item = items.find(i => i.link === url);
      if (!item) item = items.find(i => i.link === url + '/');
      if (!item) item = items.find(i => i.link?.replace(/\/$/, '') === url.replace(/\/$/, ''));

      if (!item) {
        console.error(`Post ${url} not found in RSS feed (may be old, paywalled, or draft)`);
        return null;
      }

      // Extract / clean values
      const title = item.title || "No title";

      // Author: prefer creator → author → fallback to publication name
      const author =
        item.creator ||
        item.author ||
        feed.title ||
        "Unknown Author";

      // Date: use pubDate if available
      const date = item.pubDate || item.isoDate || null;

      // Image: look in content:encoded / description for first <img> src (common pattern in Substack RSS)
      let imageUrl = null;
      const content = item['content:encoded'] || item.content || item.description || '';
      const imgMatch = content.match(/<img[^>]+src=["'](.*?)["']/i);
      if (imgMatch && imgMatch[1]) {
        imageUrl = imgMatch[1].trim();
      }

      return {
        url,
        title,
        author,
        imageUrl,
        date: new Date(date),
      };
    } catch (error) {
      console.error(`Failed to fetch/parse feed for ${feedUrl}: ${error.message}`);
      return null;
    }
  }

  function getPageMetadata(pageContent, $) {
    // Extract metadata manually
    const fetched = {
      title: $("title").text() || $('meta[property="og:title"]').attr("content") || "No title",
      author: $('meta[name="author"]').attr("content") ||
              $('meta[property="article:author"]').attr("content") ||
              $('meta[property="og:article:author"]').attr("content") ||
              "Anonymous",
      imageUrl: $('meta[property="og:image"]').attr("content"),
      date: $('meta[property="og:article:published_time"]').attr("content") ||
            $('meta[name="publish_date"]').attr("content") ||
            $('meta[name="date"]').attr("content") ||
            $('meta[property="article:published_time"]').attr("content") ||
            $('meta[name="publication-date"]').attr("content") ||
            $('div.dated').first().text().trim() ||
            null,
    };

    // Convert date to Date object for sorting
    fetched.date = fetched.date ? new Date(fetched.date) : new Date(0); // Distant past if no date

    return fetched;
  }

  // Note: the $ here represents the cheerio instance
  function getSubstackMetadataByHTML(pageContent, $) {
    const fetched = {
      title: null,
      author: null,
      imageUrl: null,
      date: null,
    };

    // ───────────────────────────────────────────────
    // 1. Try standard Open Graph / meta tags first
    //    (works on most sites, including Substack)
    // ───────────────────────────────────────────────
    fetched.title =
      $("title").text()?.trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      null;

    fetched.author =
      $('meta[name="author"]').attr("content")?.trim() ||
      $('meta[property="article:author"]').attr("content")?.trim() ||
      $('meta[property="og:article:author"]').attr("content")?.trim() ||
      null;

    fetched.imageUrl =
      $('meta[property="og:image"]').attr("content")?.trim() ||
      null;

    fetched.date =
      $('meta[property="og:article:published_time"]').attr("content") ||
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="publish_date"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $('meta[name="publication-date"]').attr("content") ||
      null;

    // ───────────────────────────────────────────────
    // 2. Substack-specific extraction (higher priority when present)
    // ───────────────────────────────────────────────

    // Substack often puts author name in the byline element
    if (!fetched.author) {
      const linkText = $('.post-header')
        .find('.post-label')
        .find('a')
        .first()
        .text()
        .trim() || null;

      if (!linkText) {
        console.log("Could not find the link text");
      } else {
        fetched.author = linkText;
      }
    }

    if (!fetched.title) {
      const h1Title = $('h1.post-title, .post-title h1, .post-title, [data-component-name="PostTitle"]').first()?.text()?.trim();
      if (h1Title) fetched.title = h1Title;
    }

    if (!fetched.imageUrl) {
      const heroImg = $('img.hero-image, .post-hero img, [data-component-name="PostHeroImage"] img').first()?.attr('src');
      if (heroImg) {
        // Resolve relative URLs
        if (heroImg.startsWith('/')) {
          const baseUrl = new URL(pageContent.request?.uri?.href || 'https://example.substack.com').origin;
          fetched.imageUrl = new URL(heroImg, baseUrl).href;
        } else {
          fetched.imageUrl = heroImg;
        }
      }
    }

    if (!fetched.date) {
      // Look for <time> with datetime attribute (most reliable)
      const timeEl = $('time.post-date, time.dt-published, .post-meta time').first();
      fetched.date = timeEl?.attr('datetime') || timeEl?.text()?.trim() || null;

      // Fallback: text-based date in post meta
      if (!fetched.date) {
        const dateText = $('.post-meta time, .post-date, .published-at').first()?.text()?.trim();
        if (dateText) fetched.date = dateText;
      }
    }

    // Final clean-up
    if (fetched.date) {
      // Try to normalize to ISO if it's a human-readable string
      const parsedDate = new Date(fetched.date);
      if (!isNaN(parsedDate)) {
        fetched.date = parsedDate.toISOString();
      }
    }

    return fetched;
  }
  
  eleventyConfig.addAsyncShortcode("reading_list", async function () {
    // Array to hold processed items with metadata
    let processedItems = [];

    const CACHE_FILE = path.join(__dirname, "source", "_data", "substack_data.json");

    if (process.env.ELEVENTY_ENV === "development") {
      // ────────────────────────────────────────────────
      // DEV: fetch + process + save to cache file
      // ────────────────────────────────────────────────
      console.log("[reading_list] Development mode → fetching fresh data…");

      // Pull static reading list data from file
      const items = require("./source/_data/reading_list.json");
      if (!items || !Array.isArray(items)) {
        return "";
      }

      const assetDir = path.join("public/assets", "reading_list");
      await fs.ensureDir(assetDir); // Create folder if not exists

      // Loop through items (can be strings or objects)
      for (const item of items) {
        let manual = {};
        let url;
        if (typeof item === 'object' && item.url) {
          manual = item;
          url = manual.url;
        } else if (typeof item === 'string') {
          url = item;
        } else {
          console.warn(`Invalid item in reading_list: ${JSON.stringify(item)}`);
          continue;
        }

        // Fetch page content with caching
        const pageContent = await EleventyFetch(url, {
          duration: "5m",
          type: "text",
          verbose: true,
        });

        // Parse HTML with cheerio
        const $ = cheerio.load(pageContent);

        const isSubstack = url.toLowerCase().includes('/p/') && (
          url.toLowerCase().includes('substack') ||
          // Look for substackcdn.com anywhere in the HTML (scripts, links, etc.)
          pageContent.includes('substackcdn.com')
        );

        if (isSubstack) {
          // First, try to query substack metadata by comparing against the publciation's
          // RSS feed.
          const RSSMetadata = await getSubstackMetadataByRSS(url);
          if (RSSMetadata)
            processedItems.push(RSSMetadata);
          else {
            // RSS query failed, resort to parsing the HTML DOM.
            const HTMLMetadata = getSubstackMetadataByHTML(pageContent, $);
            if (HTMLMetadata) 
              processedItems.push(HTMLMetadata);
            // If HTML parsing fails, push nothing at all.
          }
        } else {
          // NOT a Substack post
          try {
            const fetched = getPageMetadata(pageContent, $);

            // Special handling for Substack: if author is "Substack", extract from title
            if (url.toLowerCase().includes('substack')) {
              // Assume format like "Article Name - Author Name"
              const titleParts = fetched.title.split(' - ');
              if (titleParts.length > 1) {
                fetched.author = titleParts.pop().trim();
                fetched.title = titleParts.join(' - ').trim();
              }
            }

            // Override with manual if provided
            const title = manual.title || fetched.title;
            const author = manual.author || fetched.author;
            const imageUrl = manual.imageUrl || fetched.imageUrl;
            const date = manual.date || fetched.date;

            // Store processed item with all data
            processedItems.push({
              url,
              title,
              author,
              imageUrl,
              date,
            });
          } catch (error) {
            console.error(`Error processing ${url}: ${error.message}`);
          }
        }
      }

      // Sort by date descending (most recent first)
      processedItems.sort((a, b) => b.date - a.date);

      // Save processed data so production can use it
      await fs.writeFile(CACHE_FILE, JSON.stringify(processedItems, null, 2));
      console.log(`[reading_list] Wrote processed data to ${CACHE_FILE}`);
    } else {
      // ────────────────────────────────────────────────
      // PRODUCTION: read from cache (fail gracefully)
      // ────────────────────────────────────────────────
      console.log("[reading_list] Production mode → reading from cache");

      try {
        const raw = await fs.readFile(CACHE_FILE, "utf-8");
        processedItems = JSON.parse(raw);

        if (!Array.isArray(processedItems)) {
          console.warn("[reading_list] Cache file is not an array — returning empty");
          processedItems = [];
        }

        processedItems.sort((a, b) => {
          // Get dates — normalize missing/invalid values to null
          const dateA = a.date ? new Date(a.date) : null;
          const dateB = b.date ? new Date(b.date) : null;

          // Both invalid → keep original relative order (stable)
          if (dateA === null && dateB === null) {
            return 0;
          }

          // A invalid → B comes first (A should go later)
          if (dateA === null) {
            return 1;
          }

          // B invalid → A comes first
          if (dateB === null) {
            return -1;
          }

          // Both valid → descending (newer first)
          return dateB - dateA;
        });
      } catch (err) {
        console.error(`[reading_list] Cannot read cache file ${CACHE_FILE}: ${err.message}`);
        // You can decide: fail build / return empty / fallback to fetch anyway
        return "<!-- reading list cache missing in production -->";
      }
    }

    // ────────────────────────────────────────────────
    // Common rendering logic (dev + prod)
    // ────────────────────────────────────────────────
    if (processedItems.length === 0) {
      return "";
    }

    let htmlOutput = '<div class="reading-list-container"><ul class="reading-list">';

    // Now build HTML from sorted items
    for (const item of processedItems) {
      if (item.imageUrl) {
        htmlOutput += `
          <li class="reading-item">
            <div class="reading-card">
              <div class="reading-image-wrapper">
                <img src="${item.imageUrl}" alt="${item.title} preview" class="reading-preview">
                <div class="reading-overlay">
                  <h3 class="reading-title"><a href="${item.url}" target="_blank">${item.title}</a></h3>
                  <span class="reading-author">BY ${item.author.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </li>
        `;
      } else {
        htmlOutput += `
          <li class="reading-item no-image">
            <div class="reading-card reading-card--text-only">
              <h3 class="reading-title"><a href="${item.url}" target="_blank">${item.title}</a></h3>
              <span class="reading-author">BY ${item.author.toUpperCase()}</span>
            </div>
          </li>
        `;
      }
    }

    htmlOutput += "</ul></div>";
    return htmlOutput;
  });

  eleventyConfig.addFilter("formatDate", function(value, format = "MMMM Do, YYYY") {
    if (!value) return;

    let date;

    if (typeof value === "string") {
      date = new Date(value);
    } else if (value instanceof Date) {
      date = value;
    } else {
      return "";
    }

    if (isNaN(date.getTime())) return "";

    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();
    const day = date.getUTCDate();

    const fullMonth = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const shortMonth = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

    function getOrdinalSuffix(n) {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return (s[(v - 20) % 10] || s[v] || s[0]);
    }

    const tokens = {
      YYYY: year.toString(),
      YY: (year % 100).toString().padStart(2, '0'),
      MMMM: fullMonth,
      MMM: shortMonth,
      MM: (monthIndex + 1).toString().padStart(2, '0'),
      M: (monthIndex + 1).toString(),
      DD: day.toString().padStart(2, '0'),
      D: day.toString(),
      Do: day + getOrdinalSuffix(day)
    };

    return format.replace(/YYYY|MMMM|MMM|Do|YY|DD|MM|M|D/g, match => tokens[match] || match);
  });

  return {
    dir: {
      input: "source",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data",
      output: "public",
    },
    passthroughFileCopy: true,
    htmlTemplateEngine: "njk"
  };
};