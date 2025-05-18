// .github/fetch_feeds.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('https://example.substack.com/feed', { waitUntil: 'networkidle2' });
  const content = await page.content();
  console.log(content);
  await browser.close();
})();