import { createABURL, normalizeContentUrl, resolveUrlPath, activeIcons, inactiveIcons } from "./tools.js";

/**
 * Check if a URL is http(s).
 * @param {string} url URL to test.
 * @returns {boolean} True for http or https.
 * @example isHttpUrl('https://example.com') // true
 * @example isHttpUrl('ftp://example.com') // false
 */
function isHttpUrl(url) {
	try {
		const p = new URL(url).protocol;
		return p === "http:" || p === "https:";
	} catch {
		return false;
	}
}

// Any changes to the URL call this- even a querystring change
chrome.tabs.onUpdated.addListener(function (_tabId, changeInfo, updatedTab) {
	//Check for ABUids on loading (we don't want to wait until it finishes loading to check, in some cases that could take a while or the ABUid could break PHP or other web code)
	if (changeInfo.status === "loading") {
		//console.log(updatedTab.url);

		//Save the URL without an ABUid
		if (!updatedTab.url) {
			console.error("onUpdated loading: Tab URL is undefined or null");
			return;
		}

		if (!isHttpUrl(updatedTab.url)) {
			return;
		}

		let newURL = updatedTab.url.replace(/(\?|\&)ABUid.*/, "");

		//If the URL had an ABUid, remove it
		if (newURL !== updatedTab.url) {
			//console.log("Replace state and stuff");

			//Loads the page without the ABUid
			if (updatedTab.id) {
				try {
					chrome.scripting.executeScript({
						target: { tabId: updatedTab.id },
						func: (/** @type {string} */ url) => location.replace(url),
						args: [newURL],
					});
				} catch (e) {
					console.warn("Failed to replace URL on navigation:", e);
				}
			}

			//history.replaceState({},'',newURL);
			//location.reload();
			//chrome.tabs.update(tabId,{url:newURL});
		}

		// Proactively clear any previously injected YouTube interval when navigating
		if (updatedTab.id) {
			try {
				chrome.scripting.executeScript({
					target: { tabId: updatedTab.id, allFrames: true },
					func: () => {
						// @ts-ignore
						if (window.ABUYT) {
							// @ts-ignore
							clearInterval(window.ABUYT);
							// @ts-ignore
							window.ABUYT = undefined;
						}
					},
				});
			} catch (e) {
				console.warn("Failed to clear ABUYT interval on navigation:", e);
			}
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
		if (!getTab) {
			// Tab may have been closed or become unavailable
			return;
		}
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
		console.error("updateTabInfo: Tab URL is undefined or null");
		return;
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
			console.error("updateTabInfo storage.get: Tab URL or title is undefined or null");
			return;
		}
		//NOT DONE YET: If the page is part of a higher domain that we ARE keeping track of but we don't have a direct domain for this one, let's go up some levels:

		const domain = resolveUrlPath(storage, normalizeContentUrl(thisTab.url, thisTab.title, storage));

		// In case this gets changed elsewhere, keep it the same here
		let localDomain = domain;
		const localDomainData = storage[localDomain];

		//If this domain has an ABUkmark associated with it
		if (localDomainData) {
			//Check that the bookmark hasn't been deleted
			chrome.bookmarks.search("ABUid=" + localDomainData.ABUid, async function (targetABUkmark) {
				if (!thisTab.url) {
					console.error("bookmarks.search callback: Tab URL is undefined or null");
					return;
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
