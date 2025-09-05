import {
	activeIcons,
	inactiveIcons,
	ABUState,
	checkLevels,
	getProgress,
	getWebpage,
	createABURL,
} from "./common.js";

//Warn about home page ABUkmarks going everywhere if they're on the home page

console.log(
	"May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P"
);

//Any changes to the URL call this- even a querystring change
chrome.tabs.onUpdated.addListener(function (_tabId, changeInfo, updatedTab) {
	//Check for ABUids on loading (we don't want to wait until it finishes loading to check, in some cases that could take a while or the ABUid could break PHP or other web code)
	if (changeInfo.status == "loading") {
		//Save the URL without an ABUid
		if (!updatedTab.url) return;
		var newURL = updatedTab.url.replace(/(\?|&)ABUid.*/, "");

		//If the URL had an ABUid, remove it
		if (newURL !== updatedTab.url) {
			//Loads the page without the ABUid
			if (updatedTab.id) {
				chrome.tabs.update(updatedTab.id, { url: newURL });
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
		updateTabInfo(getTab);
	});
});

/**
 * @overload
 * @param {chrome.tabs.Tab} tab
 * @returns {{id:number, url:string, title:string, favIconUrl:string}}
 */
/**
 * @overload
 * @param {chrome.tabs.Tab} tab
 * @param {{includeTitle?: true, includeFavIcon?: true}} options
 * @returns {{id:number, url:string, title:string, favIconUrl:string}}
 */
/**
 * @overload
 * @param {chrome.tabs.Tab} tab
 * @param {{includeTitle?: true, includeFavIcon: false}} options
 * @returns {{id:number, url:string, title:string}}
 */
/**
 * @overload
 * @param {chrome.tabs.Tab} tab
 * @param {{includeTitle: false, includeFavIcon?: true}} options
 * @returns {{id:number, url:string, favIconUrl:string}}
 */
/**
 * @overload
 * @param {chrome.tabs.Tab} tab
 * @param {{includeTitle: false, includeFavIcon: false}} options
 * @returns {{id:number, url:string}}
 */
/**
 * Verify a tab and return selected properties.
 * @param {chrome.tabs.Tab} tab
 * @param {{includeTitle?: boolean, includeFavIcon?: boolean}} [options]
 * @throws {Error} If required properties are missing
 * @returns {{id:number, url:string, title?:string, favIconUrl?:string}}
 */
function verifyTab(tab, options = {}) {
	const { includeTitle = true, includeFavIcon = true } = options;

	// Validate required properties
	if (typeof tab.id === "undefined") {
		throw new Error("Tab must have an id");
	}
	if (typeof tab.url === "undefined") {
		throw new Error("Tab must have a url");
	}
	if (includeTitle && typeof tab.title === "undefined") {
		throw new Error("Tab must have a title");
	}
	if (includeFavIcon && typeof tab.favIconUrl === "undefined") {
		throw new Error("Tab must have a favIconUrl");
	}

	// Return only essential properties
	return {
		id: tab.id,
		url: tab.url,
		...(includeTitle && { title: tab.title }),
		...(includeFavIcon && { favIconUrl: tab.favIconUrl }),
	};
}

/**
 * Updates the icon and ABUkmark for a given tab
 * @param {chrome.tabs.Tab} thisTab - The tab to update
 */
function updateTabInfo(thisTab) {
	///Tab-specific code
	const tab = verifyTab(thisTab, { includeFavIcon: false });
	//YOUTUBE// add time of video
	if (/youtube.com\/watch/.test(tab.url)) {
		//We cannot run functions, like document.getElementById("movie_player").getCurrentTime(), but we can read values. So we have to use a roundabout method to get what we want; the best seems to be getting the aria-valuenow from ytp-progress-bar

		// As a video progresses, automatically adds
		chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: getProgress,
		});
	}

	chrome.storage.sync.get(function (/** @type {ABUStorage} */ storage) {
		//NOT DONE YET: If the page is part of a higher domain that we ARE keeping track of but we don't have a direct domain for this one, let's go up some levels:
		const path = getWebpage(tab.url, tab.title, storage);
		if (!path) return;
		ABUState.domain = checkLevels(storage, path);

		// In case this gets changed elsewhere, keep it the same here
		var localDomain = ABUState.domain;

		//If this domain has an ABUkmark associated with it
		if (storage[localDomain]) {
			//Check that the bookmark hasn't been deleted
			chrome.bookmarks.search(
				"ABUid=" + storage[localDomain]["ABUid"],
				async function (targetABUkmark) {
					//console.log(targetABUkmark);

					//If the bookmark's gone
					if (!targetABUkmark || targetABUkmark.length === 0) {
						//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
						chrome.storage.sync.remove(localDomain);
					} else {
						//If the bookmark's been found!
						//If you're saving for the comic pages, don't update bookmarks for the comic/archive pages. If this isn't a comics page, it'll run this too
						if (!(tab.url.endsWith("/archive") && localDomain.endsWith("comic/"))) {
							//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
							chrome.bookmarks.update(targetABUkmark[0].id, {
								title: tab.title + " (ABU)",
								url: createABURL(tab.url, storage[localDomain]["ABUid"]),
							});

							//TESTING FAVICONS//
							//thisTab.url=ABURL;
							//chrome.bookmarks.update(targetABUkmark[0].id,{title:thisTab.title+' (ABU)',url:thisTab.url});

							//If this new tab is the active one, update the icon:
							if (thisTab.active) {
								chrome.action.setIcon({ path: activeIcons });
							}
						}
					}
				}
			);
		} else {
			//If this webpage doesn't have an associated ABUkmark
			//If this new tab is the current one, update the icon:
			if (thisTab.active) {
				chrome.action.setIcon({ path: inactiveIcons });
			}
		}
	});
}
