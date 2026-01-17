const EleventyFetch = require("@11ty/eleventy-fetch");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require('child_process');
const footnote = require("markdown-it-footnote");
const markdownIt = require("markdown-it");
const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
});

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
  // Optional: make it "safe" so Nunjucks doesn't escape the HTML output
  eleventyConfig.addFilter("markdownSafe", function (content) {
    return eleventyConfig.getFilter("safe")(md.render(content));
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

  // Inside your .eleventy.js (or eleventy.config.js)
  eleventyConfig.addAsyncShortcode("reading_list", async function () {
    // Pull static reading list data from file
    const items = require("./source/_data/reading_list.json");
    if (!items || !Array.isArray(items)) {
      return "";
    }

    let htmlOutput = '<div class="reading-list-container"><ul class="reading-list">';
    const assetDir = path.join("public/assets", "reading_list");
    await fs.ensureDir(assetDir); // Create folder if not exists

    // Array to hold processed items with metadata (including date)
    const processedItems = [];

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

      try {
        // Fetch page content with caching
        const pageContent = await EleventyFetch(url, {
          duration: "5m",
          type: "text",
          verbose: true,
        });

        // Parse HTML with cheerio
        const $ = cheerio.load(pageContent);

        // Extract metadata (fetched)
        const fetched = {
          title: $("title").text() || $('meta[property="og:title"]').attr("content") || "No title",
          author: $('meta[name="author"]').attr("content") ||
                  $('meta[property="article:author"]').attr("content") ||
                  $('meta[property="og:article:author"]').attr("content") ||
                  "Unknown Author",
          imageUrl: $('meta[property="og:image"]').attr("content"),
          date: null,
        };

        // Extract date: standard meta tags first
        fetched.date = $('meta[property="og:article:published_time"]').attr("content") ||
                       $('meta[name="publish_date"]').attr("content") ||
                       $('meta[name="date"]').attr("content") ||
                       $('meta[property="article:published_time"]').attr("content") ||
                       $('meta[name="publication-date"]').attr("content");

        if ((!fetched.date || isNaN(new Date(fetched.date).getTime())) && url) {
          exec(`python3 get_substack_date.py "${url}"`, (error, stdout, stderr) => {
            if (error) {
              console.error(`Python exec error: ${error}`);
              return;
            }
            try {
              const result = JSON.parse(stdout);
              if (result.date) {
                fetched.date = result.date;
              } else if (result.error) {
                console.warn(`Python error: ${result.error}`);
              }
            } catch (parseErr) {
              console.error(`Parse error: ${parseErr}`);
            }
          });
        }

        // Convert date to Date object for sorting (fallback to now if invalid/missing)
        fetched.date = fetched.date ? new Date(fetched.date) : new Date(0); // Distant past if no date

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

    // Sort by date descending (most recent first)
    processedItems.sort((a, b) => b.date - a.date);

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