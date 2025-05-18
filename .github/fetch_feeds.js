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

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	const results = [];

	for (const url of data.feeds) {
	  try {
	    // Introduce a 1-second delay between requests
	    await delay(1000);

	    const response = await fetch(url, {
	      headers: {
	        'User-Agent':
	          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
	        'Accept':
	          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	        'Accept-Language': 'en-US,en;q=0.5',
	        'Connection': 'keep-alive',
	        'Referer': url,
	        'DNT': '1',
	        'Upgrade-Insecure-Requests': '1',
	      },
	    });

	    if (!response.ok) {
	      // Log detailed response information for debugging
	      /*console.log({
	        url,
	        status: response.status,
	        headers: Object.fromEntries(response.headers.entries()),
	      });*/

	      // Retry once after a short delay if a 403 Forbidden response is received
	      if (response.status === 403) {
	        //console.log(`Retrying ${url} after 2 seconds due to 403 response`);
	        await delay(2000);
	        const retryResponse = await fetch(url, {
	          headers: {
	            'User-Agent':
	              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
	            'Accept':
	              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	            'Accept-Language': 'en-US,en;q=0.5',
	            'Connection': 'keep-alive',
	            'Referer': url,
	            'DNT': '1',
	            'Upgrade-Insecure-Requests': '1',
	          },
	        });

	        if (!retryResponse.ok) {
	          throw new Error(`Retry failed with status: ${retryResponse.status}`);
	        }

	        const body = await retryResponse.text();
	        results.push({ url, content: body });
	        continue;
	      }

	      throw new Error(`HTTP error! Status: ${response.status}`);
	    }

	    const body = await response.text();
	    results.push({ url, content: body });
	  } catch (error) {
	    await delay(500);
	  }
	}


    console.log(results);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();
