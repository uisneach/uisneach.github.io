const bannerExtractors = {
  'mansworldmag.online': item => {
    const $ = cheerio.load(item.contentEncoded);
    // Remove promo lines
    item.contentSnippet = item.contentSnippet
      .replace(/(The|This) post .*?https?:\/\/\S+\.*$/i, '')
      .trim();
    // Extract author
    const authorMatch = item.contentSnippet.match(/^(Essay|Fiction) by ([^|]+)\s*\|/i);
    if (authorMatch) item.creator = authorMatch[2].trim();
    // Extract banner image
    const img = $('img[src*="mansworldmag.online/wp-content/uploads/"]').first();
    item.bannerImage = img.attr('src') || item.channelImageURL;
    return item;
  },
  'theburkean.ie': item => {
    const $ = cheerio.load(item.contentEncoded);
    const bg = $('div.site-header-bg').attr('style') || '';
    const m = bg.match(/url\((.*?)\)/);
    item.bannerImage = (m && m[1].replace(/&amp;/g, '&')) || item.channelImageURL;
    return item;
  }
  // …add more domains here
};

function isImageUrl(url) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(url);
}

(async () => {
  const feedUrls = [
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
    'https://montanaclassicalcollege.substack.com/feed'
  ];

  console.log(feedUrls);

  let allItems = [];

  for (let feedUrl of feedUrls) {
    try {
      // 3) Fetch via rss2json API
      const apiUrl = 'https://api.rss2json.com/v1/api.json'
                    + '?rss_url=' + encodeURIComponent(feedUrl);
      const resp = await fetch(apiUrl);
      const json = await resp.json();
      if (json.status !== 'ok') throw new Error(json.message);

      const direct = await fetch('https://thedorianinvasion.substack.com/feed');
      console.log("Direct");
      console.log(direct);

      const chanImg = json.feed.image || '';

      const items = json.items.map(raw => ({
        title:           raw.title,
        link:            raw.link,
        pubDate:         raw.pubDate,
        contentSnippet:  raw.contentSnippet,
        contentEncoded:  raw.content,
        enclosureUrl:    raw.enclosure?.link || '',
        creator:         raw.creator || '',
        channelImageURL: chanImg
      }));

      for (let item of items) {
        if (item.enclosureUrl && isImageUrl(item.enclosureUrl)) {
          item.bannerImage = item.enclosureUrl;
        } else {
          const domain = new URL(item.link).hostname.replace(/^www\./, '');
          if (bannerExtractors[domain]) {
            item = bannerExtractors[domain](item);
          } else {
            item.bannerImage = chanImg;
          }
        }
      }

      allItems = allItems.concat(items);
    } catch (err) {
      console.error('Error loading feed', feedUrl, err);
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    const container = document.getElementById('rss-reader');
    for (let item of allItems) {
      const card = document.createElement('div');
      card.className = 'rss-card';
      card.innerHTML = `
        <img class="rss-image" src="${item.bannerImage}" alt="">
        <div class="rss-content">
          <a href="${item.link}" class="rss-title">${item.title}</a>
          <div class="rss-meta">${item.creator} | ${new Date(item.pubDate).toLocaleDateString()}</div>
          <p class="rss-snippet">${item.contentSnippet}</p>
        </div>
      `;
      container.appendChild(card);
    }
})();