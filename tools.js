const Get = {
	/**
	 * Gets an element by its ID.
	 * @param {string} id - The element ID.
	 * @returns {HTMLElement} The found element.
	 * @throws {Error} If element ID is not found.
	 */
	elementByID(id) {
		const item = document.getElementById(id);
		if (item === null) {
			throw new Error(`Element "${id}" is not found.`);
		} else {
			return item;
		}
	},
	/**
	 * Gets a button element by its ID.
	 * @param {string} id - The button ID.
	 * @returns {HTMLButtonElement} The found button element.
	 * @throws {Error} If element ID is not found or is not a button.
	 */
	button(id) {
		const item = document.getElementById(id);
		if (item === null) {
			throw new Error(`Button "${id}" is not found.`);
		} else {
			if (item instanceof HTMLButtonElement) {
				return item;
			} else {
				throw new Error(`Element "${id}" is not a button.`);
			}
		}
	},
	/**
	 * Gets elements by tag name.
	 * @param {string} tag - The tag name.
	 * @returns {HTMLCollectionOf<Element>} Collection of found elements.
	 * @throws {Error} If no elements are found.
	 */
	elementByTag(tag) {
		const item = document.getElementsByTagName(tag);
		if (item === null) {
			console.log("element:", item);
			throw new Error("Element is null in elementByTag.");
		} else {
			return item;
		}
	},
	/**
	 * Gets elements by class name.
	 * @param {string} className - The class name.
	 * @returns {Element[]} Array of found elements.
	 * @throws {Error} If any element is null.
	 */
	elementsByClass(className) {
		const elements = Array.from(document.getElementsByClassName(className));
		const checked_items = [];
		for (const element of elements) {
			if (element === null) {
				console.log("element:", element);
				continue;
			}
			checked_items.push(element);
		}
		return checked_items;
	},
	/**
	 * Gets the bounding client rect of an element.
	 * @param {string} id - The element ID.
	 * @returns {DOMRect} The element's bounding client rect.
	 */
	boundingClientRect(id) {
		const element = this.elementByID(id);
		return element.getBoundingClientRect();
	},
};
/**
 * Creates a URL with an ABU (Automatic Bookmark Updater) identifier appended as a query parameter.
 * The function automatically handles the appropriate URL parameter separator (? or &) based on the input URL.
 *
 * @param {string} url - The base URL to which the ABU identifier will be appended
 * @param {string|number} ABUid - The unique identifier to be added to the URL
 * @returns {string} The modified URL with the ABU identifier as a query parameter
 */
function createABURL(url, ABUid) {
	//ABURL is the URL that ABU creates that specifies the bookmark is ABU; it just appends a querystring with the id
	return url + (url.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + ABUid;
}

/**
 * Updates the notification element's content and visibility, and sets up the click handler
 * for creating a new ABUkmark when the notification is shown.
 *
 * @param {string|Node|DocumentFragment} content - The content to display in the notification.
 *                                               If an empty string, the notification will be hidden.
 * @param {Function} [ABU] - The ABU function to call when creating a new ABUkmark.
 * @param {string} [domain] - The domain to use when creating a new ABUkmark.
 * @returns {void}
 */
function setNotification(content, ABU, domain) {
	const notification = Get.elementByID("notification");

	// Clear existing content
	while (notification.firstChild) {
		notification.removeChild(notification.firstChild);
	}

	// Add new content
	if (content) {
		if (typeof content === "string") {
			notification.innerHTML = content;
		} else {
			notification.appendChild(content);
		}
	}

	const onlyNewABU = document.getElementById("onlyNewABU");
	if (onlyNewABU && ABU && domain) {
		onlyNewABU.onclick = () => {
			ABU(domain, true);
		};
	}

	if (!content || (typeof content === "string" && content === "")) {
		notification.classList.add("hidden");
		notification.classList.remove("visible");
	} else {
		notification.classList.add("visible");
		notification.classList.remove("hidden");
	}
}

/**
 * Finds the highest-level matching URL path in the storage object by progressively
 * removing subdirectories from the end of the input path.
 *
 * @param {StorageObject} storage - The storage object containing URL paths as keys
 * @param {string} urlPath - The URL path to search for in the storage
 * @returns {string} The highest-level matching path found in storage, or the original urlPath if no match is found
 */
function resolveUrlPath(storage, urlPath) {
	//console.log("Looking for higher level...", storage, urlPath);

	let currentPath = urlPath,
		matchingPath = urlPath;

	// If we're on a special-case website where the title is passed instead of the URL, return it as-is
	if (urlPath.indexOf("/") === -1) {
		//console.log("Returning!");
		return urlPath;
	}

	// Test up to 10 times for deeper names
	for (let i = 0; i < 10; i++) {
		//console.log(storage[currentPath]);

		// If the current path exists in the storage, use it as the best match
		if (storage[currentPath]) {
			matchingPath = currentPath;
			break;
		}

		// Remove the last path segment and try again
		currentPath = currentPath.substring(0, currentPath.length - 1).substring(0, currentPath.lastIndexOf("/") + 1);

		// If we run 10 times and don't find a match, we'll just use the original input
	}

	//console.log("Putting out " + matchingPath);

	return matchingPath;
}

/**
 * Processes a URL to determine the appropriate level for ABUkmark creation.
 *
 * This function normalizes URLs and identifies the most relevant path segments
 * for different types of content (comics, blogs, videos, etc.). It handles special
 * cases for various websites with non-standard URL structures.
 *
 * @param {string} url - The URL to process
 * @param {string} title - The title of the page (used for certain special cases)
 * @param {StorageObject} storage - The storage object containing ABUkmark configurations
 * @returns {string} The processed URL segment to use as an ABUkmark key
 */
function normalizeContentUrl(url, title, storage) {
	// Validate input
	if (typeof url !== "string" || !url) {
		throw new Error("Invalid URL provided");
	}

	// Parse the URL to get its components
	let parsedUrl;
	try {
		// Ensure URL has a protocol for proper parsing
		const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`;
		parsedUrl = new URL(urlWithProtocol);
	} catch (e) {
		console.warn("Failed to parse URL:", url);
		return url; // Return original if we can't parse it
	}

	// Extract domain and path
	const domain = parsedUrl.hostname.replace("www.", "");
	const path = parsedUrl.pathname;

	// Initialize output with domain
	let output = domain + "/";

	// Handle different types of URLs based on their structure
	if (path) {
		// Check for special key folders (e.g., /blog/, /comic/)
		const keywordMatch = path.match(/\/(?:blog|comic|strip)\//i);
		if (keywordMatch) {
			output += keywordMatch[0].substring(1);
		}
		// Check for indicative path segments (e.g., season-, ep-, etc.)
		else {
			const indicativeMatch = path.match(/^(\/[^/]*)*?\/(?=[^/]*(?:season-|ep-|episode-|page-|p-|chapter-))/i);
			if (indicativeMatch && indicativeMatch[0]) {
				output += indicativeMatch[0].substring(1);
			} else {
				// Default to first path segment if no special patterns found
				const pathSegments = path.split("/").filter(Boolean);
				if (pathSegments.length > 0) {
					output += pathSegments.slice(0, 1).join("/") + "/";
				}
			}
		}
	}

	// Handle odd URL patterns for specific websites
	const oddUrlPatterns = [
		// Webtoons format: webtoons.com/language/genre/name/
		/webtoons\.com\/(?:[^/]+\/){2}[^/]+/i,
		// Lezhin format: lezhin.com/language/comic/title
		/lezhin\.com\/[^/]+\/comic\/[^/]+/i,
		// MangaHub format: mangahub.io/chapter/title
		/mangahub\.io\/chapter\/[^/]+/i,
	];

	for (const pattern of oddUrlPatterns) {
		const match = url.match(pattern);
		if (match) {
			output = match[0];
			break;
		}
	}

	/////////SPECIAL WEBSITE COMPATIBILITY/////////
	let special = "";

	// TAPAS.IO HANDLING
	// Handles both series and episode URLs: tapas.io/series/... or tapas.io/episode/...
	const tapasMatch = url.match(/tapas\.io\/(?:series|episode)\/([^\/?#]+)/i);
	if (tapasMatch && title) {
		// Try different title formats in order of preference
		const titleMatch = title.match(/^([^\n\r|:：\[\]【】]+)/); // Match until first occurrence of |, :, or various brackets

		if (titleMatch) {
			// Clean up the matched title
			special = titleMatch[1].trim();

			// For Tapas, we want to use the domain as the output to avoid issues with
			// series/episode switching and maintain consistency across the same comic
			output = "tapas.io/";
		} else {
			// If we can't extract a clean title, use the URL segment as fallback
			special = tapasMatch[1].replace(/[-_]+/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
			output = "tapas.io/";
		}
	}

	// YOUTUBE URLS
	// Handle various YouTube URL formats including videos, playlists, shorts, and live streams
	// First check for video ID
	const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/i);
	// Separately check for playlist ID
	const playlistMatch = url.match(/[?&]list=([^&#]*)/i);

	if (videoIdMatch) {
		const videoId = videoIdMatch[1];

		if (playlistMatch) {
			// For playlist URLs, use the list parameter
			special = `?list=${playlistMatch[1]}`;
		} else if (videoId) {
			// For video URLs, use the video ID
			special = `?v=${videoId}`;
		}
	}

	// GOOGLE SLIDES HANDLING
	// Handles Google Slides presentation URLs in various formats
	// Example: https://docs.google.com/presentation/d/presentation_id/edit?usp=sharing
	const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/?#]+)/i);
	if (slidesMatch) {
		// Use the presentation ID in the special field
		special = `docs.google.com/presentation/d/${slidesMatch[1]}/`;
	}

	//console.log(special);

	//If a special, unusual value was passed:
	if (special !== "") {
		//See if either the special exists, or a higher level does not exist; in either case, we'll use the special value
		if (storage[special] || !storage[resolveUrlPath(storage, output)]) {
			output = special;
		}
	}

	//console.log(output);

	return output;
}

export { createABURL, setNotification, resolveUrlPath, normalizeContentUrl, Get };
