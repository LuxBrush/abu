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
			chrome.tabs.executeScript(updatedTab.id, { code: "location.replace('" + newURL + "');", runAt: "document_start" });

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
		chrome.tabs.executeScript(thisTab.id, {
			allFrames: true,
			code: `
			if(!ABUYT){
				var ABUYT = setInterval(function(){
					// console.log('RUNNING INTERVAL');
					var progressBar = document.getElementsByClassName("ytp-progress-bar");
					
					if(!progressBar.length) return;
					
					// If a miniplayer is opened, we need to make sure we get the last element- that will be the main player.
					var newURL = window.location.href.replace(/&t=[^&]+|$/,"&t="+progressBar[progressBar.length-1].getAttribute("aria-valuenow"));
					
					// Don't update the history if it's the same- this wastes resources
					if(newURL === window.location.href) return;
					
					history.replaceState(null,'',newURL);
				},1000);
			}
		`,
		});
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
							chrome.browserAction.setIcon({ path: activeIcons });
						}
					}
				}
			});
		} else {
			//If this webpage doesn't have an associated ABUkmark
			//If this new tab is the current one, update the icon:
			if (thisTab.active) {
				chrome.browserAction.setIcon({ path: inactiveIcons });
			}
		}
	});
}

function createPage() {
	chrome.storage.sync.get(function (/** @type {StorageObject} */ storage) {
		//ABUVersion info
		if (!storage.ABUVersion || storage.ABUVersion < ABUVersion) {
			document.getElementsByTagName("BODY")[0].insertAdjacentHTML("afterbegin", "<p id='update'>ABU 1.4 adds support for mangahub.io. Always feel free to let me know if ABU doesn't work on any website!</p>");
			chrome.storage.sync.set({ "ABUVersion": ABUVersion });
		}

		const mainButton = Get.elementByID("current-page");
		mainButton.dataset.multiple = "0";
		//console.log(domain,domain.substr(0,domain.length-2).indexOf("/")==-1);

		console.log("url is", url);

		//If we're on the homepage, warn the user that subpages are better
		if (
			// If all of these are true, the user's on a homepage
			(domain.indexOf("/") !== -1 && domain.substring(0, domain.length - 2).indexOf("/") == -1 && !/(page|p|date)=/i.test(url) && !/tapas.io\/(series|episode)\//.test(url)) ||
			// If any of these are true, the user's on a homepage
			/mangahub.io\/manga\//.test(url)
		) {
			if (warning.indexOf("a subpage if") === -1)
				warning += "ABUkmark a subpage if possible so visiting about, archives, links, etc doesn't update bookmarks. Just click on an article, a back button, or a button to start reading and it should be perfect!<br>";
		}

		let anywhereButtonsString = "";

		domain = resolveUrlPath(storage, domain);

		//Setup buttons
		if (!storage[domain]) {
			//If we don't have an ABUkmark for this site
			chrome.bookmarks.search(domain, function (thisBookmark1) {
				if (thisBookmark1[0]) {
					const firstBookmark = thisBookmark1[0];
					if (!firstBookmark.url) {
						throw new Error("Bookmark URL is undefined or null");
					}
					//If the bookmark exists
					mainButton.innerHTML = "Convert to ABUkmark";
					mainButton.style.backgroundColor = "#9ccc5e";

					overwriteWarning(firstBookmark);

					setNotification(warning + "Will convert <em title='" + firstBookmark.url + "'>" + firstBookmark.title + "</em>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>");
					if (thisBookmark1.length > 1) {
						let bookmarksChoose = "";

						warningClass = "";

						//Create a dropdown so you can choose which to change
						for (let i = 0; i < thisBookmark1.length; i++) {
							const currentBookmark = thisBookmark1[i];
							if (!currentBookmark.url) {
								throw new Error("Current Bookmark URL is undefined or null");
							}
							warningClass = "";

							overwriteWarning(thisBookmark1[i]);

							const dropdownDomain = resolveUrlPath(storage, normalizeContentUrl(currentBookmark.url, currentBookmark.title, storage)); //checkLevels(thisBookmark1[i].url);

							//console.log(dropdownDomain);

							//Add a dropdown with the bookmarks info
							if (currentBookmark.title.indexOf(" (ABU)") === -1) {
								//If the bookmark is untitled, let the user know
								let thisBookmarkTitle = currentBookmark.title;
								if (thisBookmarkTitle == "") {
									thisBookmarkTitle = "(Untitled)";
								}

								bookmarksChoose += "<option class='" + warningClass + "' title='" + currentBookmark.url + "' data-domain='" + dropdownDomain + "' value='" + currentBookmark.id + "'>" + thisBookmarkTitle + "</option>";
							} else {
								bookmarksChoose += "<option class='overwrite' title='" + currentBookmark.url + "' data-domain='" + dropdownDomain + "' value='" + currentBookmark.id + "'>" + currentBookmark.title + "</option>";
							}
						}
						setNotification(warning + thisBookmark1.length + " bookmarks spotted. Will convert <select>" + bookmarksChoose + "</select>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>");
						mainButton.dataset.multiple = "1";
					}
				} else {
					//If it doesn't
					//Change the button's text and color
					mainButton.innerHTML = "Create ABUkmark";
					mainButton.style.backgroundColor = "#619919";
					//Set the notification if there's a warning
					if (warning !== "") {
						setNotification(warning);
					}
				}
				mainButton.onclick = function () {
					ABU(domain, false);
				};
			});
		} else {
			const domainData = storage[domain];
			if (!domainData) {
				throw new Error("No ABUkmark found for this domain in storage");
			}
			//If we have an ABUkmark for this, according to our data
			chrome.bookmarks.search("ABUid=" + domainData.ABUid, function (thisBookmark2) {
				if (!thisBookmark2) {
					chrome.storage.sync.remove(domain);
				} else {
					let check = false;
					for (const bookmarkResult of thisBookmark2) {
						if (!bookmarkResult.url) {
							console.error("Bookmark result URL is undefined or null");
							continue;
						}
						if (bookmarkResult && domain === resolveUrlPath(storage, normalizeContentUrl(bookmarkResult.url, bookmarkResult.title, storage))) {
							check = true;
						}
					}

					//GO THROUGH THE FOR LOOP (otherwise won't work with multiple pages and if in a higher-level domain; need to check for that)

					if (thisBookmark2[0] && check) {
						//If we've found out the bookmark claimed to exist does, set the button so that:
						mainButton.innerHTML = "Revert to normal bookmark";
						mainButton.style.backgroundColor = "#f00";
						mainButton.onclick = function () {
							const domainData = storage[domain];
							if (!domainData) {
								throw new Error("Domain data not found in storage for unABU operation");
							}
							unABU(domain, domainData.ABUid);
							chrome.browserAction.setIcon({ path: inactiveIcons });
						};
					} else {
						chrome.storage.sync.remove(domain);
						mainButton.innerHTML = "Create ABUkmark";
						mainButton.style.backgroundColor = "#619919";
						mainButton.onclick = function () {
							ABU(domain, false);
						};
					}
				}
			});
		}

		let storageKeys = Object.keys(storage);

		// Create buttons for removing ABUkmarks
		for (const key of storageKeys) {
			// Don't create a button for the webpage domain we're on
			// Don't create a button for the ABUVersion object, which checks the current version in use.
			if (key === domain || key === "ABUVersion") {
				continue;
			}
			const abuBookmark = storage[key];
			if (!abuBookmark) {
				throw new Error(`Storage data not found for key: ${key}`);
			}

			// Look for the bookmarks as we go through the list, to make sure they still exist.
			chrome.bookmarks.search(`ABUid=${abuBookmark.ABUid}`, (bookmarks) => {
				// If a bookmark in the list doesn't exist
				if (bookmarks.length === 0) {
					const ABUid = abuBookmark.ABUid;

					// Remove the info
					chrome.storage.sync.remove(key);

					// Remove the element, if it exists
					const abuButton = document.querySelector(`button[data-id="${ABUid}"]`);
					if (abuButton) abuButton.remove();
				}
			});

			// Add the button if it exists
			anywhereButtonsString += `<button data-id="${abuBookmark.ABUid}" data-domain="${key}">&times; <img src="${abuBookmark.favIconUrl}"> ${key}</button>`;
		}

		//If the user doesn't have any ABUkmarks, don't show the horizontal rule
		if (anywhereButtonsString == "") {
			document.getElementsByTagName("hr")[0].style.display = "none";
		}

		console.log("Any favicons not found will produce errors below (it's not really worth worrying about)");

		const anywhereDiv = document.getElementById("abu-anywhere");
		if (!anywhereDiv) {
			throw new Error("Element with ID 'abu-anywhere' not found");
		}

		anywhereDiv.innerHTML = anywhereButtonsString;

		let anywhereButtons = /** @type {HTMLCollectionOf<HTMLButtonElement>} */ (anywhereDiv.children);
		let images = document.getElementsByTagName("img");

		// Add functions for each button
		for (let ii = 0; ii < anywhereButtons.length; ii++) {
			const anywhereButton = anywhereButtons[ii];
			const domainPath = anywhereButton.dataset.domain;
			const abuId = anywhereButton.dataset.id;
			if (!domainPath || !abuId) {
				console.error("Domain or ID missing from button data attributes");
				continue;
			}
			anywhereButton.onclick = () => {
				unABU(domainPath, Number(abuId));
			};

			//Hide any images that fail to load properly
			const image = images[ii];
			image.onerror = () => {
				image.style = "display:none;";
			};
		}
	});
}

/**
 * Checks if a bookmark is an ABUkmark and adds a warning message if it is.
 *
 * This function is called when displaying bookmarks in the popup interface.
 * It detects if a bookmark is already an ABUkmark (has "(ABU)" in the title)
 * and adds a warning message to prevent users from accidentally overwriting
 * existing ABUkmarks. It also sets the warningClass to "overwrite" which
 * applies special styling to highlight the warning.
 *
 * @param {chrome.bookmarks.BookmarkTreeNode} bookmark - The bookmark object to check
 */
function overwriteWarning(bookmark) {
	if (bookmark.title.indexOf(" (ABU)") !== -1 && warning.indexOf("overwrite") == -1) {
		warningClass = "overwrite";
		warning += "<strong>Don't accidentally overwrite ABUkmarks deeper in the website!</strong> If you do it, do it on purpose. Any bookmarks ending in (ABU) are ABUkmarks.<br>";
	}
}

/**
 * Creates or updates an ABUkmark for the specified domain.
 * Converts existing bookmarks to ABUkmarks or creates new ones.
 *
 * @param {string} domainPath - The processed domain path (e.g., "example.com/blog/")
 * @param {boolean} forceCreateNew - If true, creates new ABUkmark even if bookmark exists
 * @returns {void}
 *
 * @example
 * ABU("example.com/blog/", false); // Convert existing bookmark
 * ABU("example.com/blog/", true);  // Force create new ABUkmark
 */
function ABU(domainPath, forceCreateNew) {
	const mainButton = Get.elementByID("current-page");
	let inArray = 0;
	let inArrayDomain = "";

	if (mainButton.dataset.multiple === "1") {
		const selectElement = /** @type {HTMLSelectElement} */ (document.getElementsByTagName("SELECT")[0]);
		inArray = selectElement.selectedIndex;

		//Get the bookmark to change with this:
		if (selectElement.options[selectElement.selectedIndex].className !== "") {
			const domainString = selectElement.options[selectElement.selectedIndex].dataset.domain;
			if (!domainString) {
				console.error("Domain string is undefined or null for selected bookmark");
				return;
			}
			inArrayDomain = domainString;
		}
	}

	chrome.bookmarks.search(domainPath, function (thisBookmark) {
		if (!thisBookmark[inArray] || forceCreateNew) {
			//If the bookmark doesn't exist

			//Check for ABUkmarks folder, add if doesn't exist
			chrome.bookmarks.search("ABUkmarks", function (thisFolder) {
				if (!thisFolder[0]) {
					//If folder ABUkmarks doesn't exist
					chrome.bookmarks.create({ title: "ABUkmarks" }, function (newFolder) {
						createABUkmark(domainPath, newFolder.id);
					});
				} else {
					//If the folder exists
					createABUkmark(domainPath, thisFolder[0].id);
				}
				//Not always located there; get exact location and state it
				setNotification("New ABUkmark located in <em>Other bookmarks &#8594; ABUkmarks</em>");
			});
		} else {
			//If the bookmark exists

			if (inArrayDomain !== "") {
				chrome.storage.sync.remove(inArrayDomain);
			}

			let ABUid = Date.now();

			storeABUkmark(domainPath, ABUid);

			chrome.bookmarks.update(thisBookmark[inArray].id, { title: title + " (ABU)", url: createABURL(url, ABUid) });

			setNotification("");
		}
	});

	chrome.browserAction.setIcon({ path: activeIcons });
}

/**
 * Creates a new ABUkmark (Automatic Bookmark Updater bookmark) in the browser's bookmarks.
 * The bookmark will have "(ABU)" appended to its title and a unique ID added to the URL.
 *
 * @param {string} urlIdentifier - The URL or identifier to be used for creating the ABUkmark.
 * @param {string} parentId - The ID of the parent folder where the new bookmark will be created.
 * @returns {void}
 */
function createABUkmark(urlIdentifier, parentId) {
	const ABUid = Date.now();
	chrome.bookmarks.create({ parentId, title: `${title} (ABU)`, url: createABURL(url, ABUid) }, function () {
		storeABUkmark(urlIdentifier, ABUid);
	});
}

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
 * @param {string} html - The HTML content to display in the notification.
 *                         If an empty string, the notification will be hidden.
 * @returns {void}
 */
function setNotification(html) {
	const notification = Get.elementByID("notification");
	const onlyNewABU = document.getElementById("onlyNewABU");
	notification.innerHTML = html;

	if (onlyNewABU) {
		onlyNewABU.onclick = () => {
			ABU(domain, true);
		};
	}

	notification.style.display = html !== "" ? "block" : "none";
}

/**
 * Stores ABUkmark data in Chrome's synced storage.
 *
 * @param {string} domainPath - The domain path key for the ABUkmark (e.g., "example.com/blog/")
 * @param {number} abuId - The unique ABU identifier timestamp
 * @returns {void}
 *
 * @example
 * storeABUkmark("example.com/blog/", 1672531200000);
 */
function storeABUkmark(domainPath, abuId) {
	/** @type {StorageObject} */
	const storageObj = {};
	storageObj[domainPath] = { "ABUid": abuId, "favIconUrl": favIconUrl };
	chrome.storage.sync.set(storageObj);
	createPage();
}

/**
 * Converts an ABUkmark back into a regular bookmark.
 *
 * @param {string} domainPath - The domain path key used in storage (e.g., "example.com/blog/")
 * @param {number} abuId - The unique ABU identifier to find the bookmark
 * @returns {void}
 *
 * @example
 * unABU("example.com/blog/", 1672531200000);
 */
function unABU(domainPath, abuId) {
	//Get the bookmark
	chrome.bookmarks.search("ABUid=" + abuId, function (targetABUkmark) {
		const ABUkmark = targetABUkmark[0];
		if (!ABUkmark.url) {
			console.error("ABUkmark URL is undefined or null");
			return;
		}
		//Remove the ABU tag
		chrome.bookmarks.update(ABUkmark.id, {
			url: ABUkmark.url.replace(/(\?|&)ABUid=[0-9]+/g, ""),
			title: ABUkmark.title.replace(" (ABU)", ""),
		});
	});
	chrome.storage.sync.remove(domainPath, function () {
		setNotification("");
		createPage();
	});
}

//Run a popup's element is present, run the popup script!
if (document.getElementById("current-page")) {
	console.log("ABU popup loaded!");

	//Have notifications depending on what's done
	const mainButton = Get.elementByID("current-page");
	mainButton.dataset.multiple = "0";

	//Get URL
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		//console.log(tabs);
		//Need to get storage here, for getting the webpage
		chrome.storage.sync.get(function (/** @type {StorageObject} */ storage) {
			const activeTab = tabs[0];
			if (!activeTab.url || !activeTab.title || !activeTab.favIconUrl) {
				console.error("Tab URL, title, or favIconUrl is undefined or null");
				return;
			}
			url = activeTab.url;
			domain = normalizeContentUrl(url, activeTab.title, storage);
			title = activeTab.title;
			favIconUrl = activeTab.favIconUrl;

			//Link to email me
			Get.elementByID("email").onclick = () => {
				chrome.tabs.create({ active: true, url: "mailto:joshuapowlison@gmail.com", index: tabs[0].index + 1 });
			};

			//Link to my website
			Get.elementByID("website").onclick = () => {
				chrome.tabs.create({ active: true, url: "https://joshpowlison.com/", index: tabs[0].index + 1 });
			};

			createPage();
		});
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
