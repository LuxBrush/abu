import { createABURL, setNotification } from "./tools.js";
const { Get } = Check();
//Icons
const activeIcons = { "128": "icons/128blue.png" };
const inactiveIcons = { "128": "icons/128gray.png" };
const ABUVersion = 1.4;

//Call the variables here
let url = "";
let domain = "";
let title = "";
let favIconUrl = "";
let warningClass = "";

//Warn about home page ABUkmarks going everywhere if they're on the home page
let warning = "";

console.log("May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P");

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
	const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/(?!.*?\blist=)|.*[?&]v=)|youtu\.be\/)([\w-]{11})(?:(?:(?=[^?&]*\?)|[?&])(?:list=|t=|start=|end=)([^&]*))?/i);

	if (ytMatch) {
		const videoId = ytMatch[1];
		const listId = ytMatch[2];

		if (listId) {
			// For playlist URLs, use the list parameter
			special = `?list=${listId}`;
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

//Any changes to the URL call this- even a querystring change
chrome.tabs.onUpdated.addListener(function (_tabId, changeInfo, updatedTab) {
	//Check for ABUids on loading (we don't want to wait until it finishes loading to check, in some cases that could take a while or the ABUid could break PHP or other web code)
	if (changeInfo.status === "loading") {
		//console.log(updatedTab.url);

		//Save the URL without an ABUid
		if (!updatedTab.url) {
			throw new Error("Tab URL is undefined or null");
		}
		let newURL = updatedTab.url.replace(/(\?|\&)ABUid.*/, "");

		//If the URL had an ABUid, remove it
		if (newURL !== updatedTab.url) {
			//console.log("Replace state and stuff");

			//Loads the page without the ABUid
			if (updatedTab.id) {
				chrome.scripting.executeScript({
					target: { tabId: updatedTab.id },
					func: (/** @type {string} */ url) => location.replace(url),
					args: [newURL],
				});
			}

			//history.replaceState({},'',newURL);
			//location.reload();
			//chrome.tabs.update(tabId,{url:newURL});
		}
	}

	//Save the data if we're not switching from an ABUid tab (must be complete to get the title)
	if (changeInfo.status == "complete" || changeInfo.title) {
		//YouTube seems to have an AJAX setup now; when the title's been adjusted, we should be good to go! (status doesn't go to complete, which implies AJAX setup)
		updateTabInfo(updatedTab);
	}
});

//When change tabs, update icon

//We will check for onActivated so that when you switch tabs the icon can update. And, that way, if you have multiple tabs open for the same domain, whichever one you visit sets the ABUkmark (so it can switch dynamically)
chrome.tabs.onActivated.addListener(function (activatedTab) {
	//activatedTab only returns the tabId and windowId, so we need to use chrome.tabs.get to get the data we're REALLY interested in:
	chrome.tabs.get(activatedTab.tabId, function (getTab) {
		updateTabInfo(getTab);
	});
});

/**
 * Updates tab-specific information and handles YouTube video progress tracking.
 * This function is called when a tab is updated or activated. It handles special
 * cases like YouTube video progress tracking and updates the browser action icon
 * based on whether the current URL has an associated ABUkmark.
 *
 * @param {chrome.tabs.Tab} thisTab - The tab object containing information about the active tab
 */
function updateTabInfo(thisTab) {
	if (!thisTab.url) {
		throw new Error("Tab URL is undefined or null");
	}
	///Tab-specific code
	//YOUTUBE// add time of video
	if (/youtube.com\/watch/.test(thisTab.url)) {
		//We cannot run functions, like document.getElementById("movie_player").getCurrentTime(), but we can read values. So we have to use a roundabout method to get what we want; the best seems to be getting the aria-valuenow from ytp-progress-bar

		// As a video progresses, automatically adds
		if (thisTab.id) {
			chrome.scripting.executeScript({
				target: { tabId: thisTab.id, allFrames: true },
				func: () => {
					// @ts-ignore
					if (!window.ABUYT) {
						// @ts-ignore
						window.ABUYT = setInterval(function () {
							// console.log('RUNNING INTERVAL');
							const progressBar = document.getElementsByClassName("ytp-progress-bar");

							if (!progressBar.length) return;

							// If a miniplayer is opened, we need to make sure we get the last element- that will be the main player.
							const newURL = window.location.href.replace(/&t=[^&]+|$/, "&t=" + progressBar[progressBar.length - 1].getAttribute("aria-valuenow"));

							// Don't update the history if it's the same- this wastes resources
							if (newURL === window.location.href) return;

							history.replaceState(null, "", newURL);
						}, 1000);
					}
				},
			});
		}
	}

	chrome.storage.sync.get(function (/** @type {StorageObject} */ storage) {
		if (!thisTab.url || !thisTab.title) {
			throw new Error("Tab URL or title is undefined or null");
		}
		//NOT DONE YET: If the page is part of a higher domain that we ARE keeping track of but we don't have a direct domain for this one, let's go up some levels:

		domain = resolveUrlPath(storage, normalizeContentUrl(thisTab.url, thisTab.title, storage));

		// In case this gets changed elsewhere, keep it the same here
		let localDomain = domain;
		const localDomainData = storage[localDomain];

		//If this domain has an ABUkmark associated with it
		if (localDomainData) {
			//Check that the bookmark hasn't been deleted
			chrome.bookmarks.search("ABUid=" + localDomainData.ABUid, async function (targetABUkmark) {
				if (!thisTab.url) {
					throw new Error("Tab URL is undefined or null");
				}
				//console.log(targetABUkmark);

				//If the bookmark's gone
				if (!targetABUkmark || targetABUkmark.length === 0) {
					//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
					chrome.storage.sync.remove(localDomain);
				} else {
					//If the bookmark's been found!
					//If you're saving for the comic pages, don't update bookmarks for the comic/archive pages. If this isn't a comics page, it'll run this too
					if (!(thisTab.url.endsWith("/archive") && localDomain.endsWith("comic/"))) {
						//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
						chrome.bookmarks.update(targetABUkmark[0].id, { title: thisTab.title + " (ABU)", url: createABURL(thisTab.url, localDomainData.ABUid) });

						//TESTING FAVICONS//
						//thisTab.url=ABURL;
						//chrome.bookmarks.update(targetABUkmark[0].id,{title:thisTab.title+' (ABU)',url:thisTab.url});

						//If this new tab is the active one, update the icon:
						if (thisTab.active) {
							chrome.action.setIcon({ path: activeIcons });
						}
					}
				}
			});
		} else {
			//If this webpage doesn't have an associated ABUkmark
			//If this new tab is the current one, update the icon:
			if (thisTab.active) {
				chrome.action.setIcon({ path: inactiveIcons });
			}
		}
	});
}

function Check() {
	return {
		Get: {
			/**
			 * Gets an element by its ID.
			 * @param {string} id - The element ID.
			 * @returns {HTMLElement} The found element.
			 * @throws {Error} If element is not found.
			 */
			elementByID(id) {
				const item = document.getElementById(id);
				if (item === null) {
					console.log("element:", item);
					throw new Error("Element is null in elementByID.");
				} else {
					return item;
				}
			},
			/**
			 * Gets a button element by its ID.
			 * @param {string} id - The button ID.
			 * @returns {HTMLButtonElement} The found button element.
			 * @throws {Error} If element is not found or is not a button.
			 */
			button(id) {
				const item = document.getElementById(id);
				if (item === null) {
					console.log("element:", item);
					throw new Error("Element is null in button.");
				} else {
					if (item instanceof HTMLButtonElement) {
						return item;
					} else {
						throw new Error("Element is not a button.");
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
		},
	};
}
