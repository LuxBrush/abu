chrome.runtime.onConnect.addListener((port) => {
	port.onMessage.addListener((/** @type {commData} */ message) => {
		const updatedData = functions[message.functionName](message.properties);
		if (updatedData) {
			port.postMessage(updatedData);
		}
	});
});

/** @type {Functions} */
const functions = {
	/**
	 * Stores bookmark data in Chrome's synced storage
	 * @param {BookmarkProperties} properties - An object containing the bookmark key, bookmark id, and favicon url
	 * @returns {boolean} Returns true if the operation was successful, false otherwise
	 */
	saveBookmarkData(properties) {
		try {
			const { bookmarkKey, bookmarkId, favIconUrl } = properties;
			const storageData = { [bookmarkKey]: { "ABUid": bookmarkId, favIconUrl } };
			chrome.storage.sync.set(storageData);
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	},
	/**
	 * Processes a URL to generate a normalized webpage identifier for ABUkmark storage.
	 * This method normalizes URLs by extracting the most relevant path segments while handling
	 * special cases for various websites. The algorithm works as follows:
	 *
	 * 1. Extracts URL segments up to numbered sections or query strings
	 * 2. Removes protocol and www prefix
	 * 3. Handles special key folders like '/blog/' or '/comic/'
	 * 4. Detects and processes indicative keywords (season-, ep-, episode-, etc.)
	 * 5. Applies special handling for specific websites:
	 *    - Webtoons: Extracts language/genre/name pattern
	 *    - Lezhin: Extracts language/comic/title pattern
	 *    - Mangahub: Extracts chapter/title pattern
	 *    - Tapas: Uses comic title from page title when available
	 *    - YouTube: Handles both playlist IDs and video IDs
	 *    - Google Slides: Extracts presentation ID
	 * 6. Performs storage-based validation for special cases
	 *
	 * @param {WebPageIdProperties} properties - Object containing URL and metadata
	 * @returns {string} A normalized string representing the webpage, suitable for use as an identifier
	 */
	getWebPageId(properties) {
		const { url, title, storage } = properties;

		// Extract URL path up to numbered sections or query strings
		// This regex matches: protocol://domain/path/ but stops before numbered sections
		const pathMatch = /(\S+\/\/+[^\/]+[^\d\?]+\/)+(?!$)/.exec(url);
		const urlToProcess = pathMatch?.[0] || url;

		// Remove protocol and optional www prefix
		const protocolAndWwwRegex = /[^\/]+\/\/(www\.)?/;
		let outputUrl = urlToProcess.replace(protocolAndWwwRegex, "");

		// Get everything up until 1) a numbered section (past the domain) or 2) a querystring

		// Remove http (and www too, if it's present)
		if (outputUrl) outputUrl = outputUrl[0].replace(/[^\/]+\/\/(www.)?/, "");
		else outputUrl = url.replace(/[^\/]+\/\/(www.)?/, "");

		// Check for special key folders; go up to those
		/*
			/blog/
			/comic/
		*/
		const keywordMatch = /.+\/(blog|comic)\//.exec(outputUrl);
		if (keywordMatch !== null && keywordMatch[0]) {
			outputUrl = keywordMatch[0];
		}

		// Check for indicative keywords; go up to those
		const indicativeMatch = /.+\/(?=season-|ep-|episode-|page-|p-)/.exec(outputUrl);
		if (indicativeMatch !== null && indicativeMatch[0]) {
			outputUrl = indicativeMatch[0];
		}

		///////// ODD-URL WEBSITES COMPATIBILITY /////////
		/** @type {RegExpExecArray | null} */
		let websiteMatch = null;

		// WEBTOONS // webtoons.com/language/genre/name/
		if (websiteMatch === null) {
			websiteMatch = /webtoons\.com\/[^/]+\/[^/]+\/[^/]+\//.exec(url);
		}

		// LEZHIN // lezhin.com/language/comic/title
		if (websiteMatch === null) {
			websiteMatch = /lezhin\.com\/[^/]+\/comic\/[^/]+\//.exec(url);
		}

		// MANGAHUB.IO // mangahub.com/chapter/title
		if (websiteMatch === null) {
			websiteMatch = /mangahub\.io\/chapter\/[^/]+\//.exec(url);
		}

		if (websiteMatch !== null && websiteMatch[0]) {
			outputUrl = websiteMatch[0];
		}

		/////////SPECIAL WEBSITE compatibility/////////
		/** @type {string | null} */
		let special = null;

		//TAPAS// tapas.io/episode/ (same for every comic; we have to test by title)
		//console.log(input);
		if (/tapas\.io\/(series|episode)\//.test(url) && title) {
			// Extract comic title from page title (separated by :: or |)
			const titleSeparatorRegex = /.+(?=\s(?::|\|))/;
			const titleMatch = titleSeparatorRegex.exec(title);

			if (titleMatch === null || !titleMatch[0] || titleMatch[0].trim() === "") {
				throw new Error(`Failed to extract comic title from TAPAS page title: "${title}"`);
			}

			special = titleMatch[0].trim();

			// Use generic tapas.io/ to avoid issues with series/episode URL switching
			outputUrl = "tapas.io/";
		}

		//YOUTUBE PLAYLIST// https://www.youtube.com/playlist?list=id
		if (/youtube.com\/.+list=/.test(url)) {
			//Get the playlist id
			const playlistMatch = /(?:\?|&)list=[^?&]*/.exec(url);
			if (playlistMatch) {
				special = playlistMatch[0];
			}
		} else if (/youtube.com\/watch\?v=[^?&]*/.test(url)) {
			//Get the video id and track time
			const videoMatch = /(?:\?|&)v=[^?&]*/.exec(url);
			if (videoMatch) {
				special = videoMatch[0];
			}
		}

		//GOOGLE SHEETS PRESENTATION// https://docs.google.com/presentation/d/slideshow_id/relevant_stuff
		if (/docs.google.com\/presentation\/d\/.+\//.test(url)) {
			//Get the slideshow url
			const presentationMatch = /docs.google.com\/presentation\/d\/.+\//.exec(url);
			if (presentationMatch) {
				special = presentationMatch[0];
			}
		}

		//console.log(special);

		//If a special, unusual value was passed:
		if (special) {
			//See if either the special exists, or a higher level does not exist; in either case, we'll use the special value
			if (storage[special] || !storage[checkLevels(storage, outputUrl)]) {
				outputUrl = special;
			}
		}

		return outputUrl;
	},
};

/**
 * Traverses up URL path levels to find the highest level that exists in the provided object.
 *
 * This function is used to find the most appropriate URL path level for bookmark storage.
 * It works by progressively removing path segments from the end of the URL and checking
 * if the resulting path exists as a key in the provided object. This helps in finding
 * the most general bookmark that applies to the current page.
 *
 * @param {ABUStorage} storage - The storage object to check against, typically containing bookmarked URLs as keys
 * @param {string} url - The URL path or identifier to check
 * @returns {string} The highest level path that exists in the object, or the original input if none found
 */
function checkLevels(storage, url) {
	// Starting with the full input path
	let testUrl = url,
		outputUrl = url;

	// Handle special case: if input doesn't contain a slash, it's likely a title rather than a URL
	// In this case, return the input as is without further processing
	if (url.indexOf("/") === -1) {
		return url;
	}

	// Attempt to find existing paths by progressively removing segments from the end
	// Limited to 10 iterations to prevent infinite loops on very long paths
	for (let i = 0; i < 10; i++) {
		// If the current test path exists in our object, use it as output and stop searching
		if (storage[testUrl]) {
			outputUrl = testUrl;
			break;
		}

		// If not found, remove the last path segment and try again
		// This removes the trailing slash and everything after the previous slash
		testUrl = testUrl.slice(0, testUrl.length - 1).slice(0, testUrl.lastIndexOf("/") + 1);

		// If we've tried 10 times without finding a match, we'll use the original input
	}

	return outputUrl;
}
