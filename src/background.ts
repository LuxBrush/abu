import {
	activeIcons,
	inactiveIcons,
	ABUState,
	getWebpage,
	checkLevels,
	createABURL,
	getProgress
} from "./common.js";

console.log(
	"May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P"
);

//Any changes to the URL call this- even a querystring change
chrome.tabs.onUpdated.addListener(function (_tabId, changeInfo, updatedTab) {
	if (!updatedTab.url) {
		console.error("Tab update received with no URL - cannot process");
		return;
	}
	//Check for ABUids on loading (we don't want to wait until it finishes loading to check, in some cases that could take a while or the ABUid could break PHP or other web code)
	if (changeInfo.status == "loading") {
		//console.log(updatedTab.url);

		//Save the URL without an ABUid
		const newURL = updatedTab.url.replace(/(\?|\&)ABUid.*/, "");

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
 * Updates the browser action icon and ABUkmark for the given tab.
 * This function is the core logic that runs on tab updates and activation.
 * It determines if a page is already an ABUkmark, updates the bookmark URL,
 * and sets the appropriate icon.
 * @param thisTab The tab to update information for.
 */
function updateTabInfo(thisTab: chrome.tabs.Tab) {
	if (!thisTab.url || !thisTab.title || !thisTab.id) return;
	const tabUrl = thisTab.url;
	const tabTitle = thisTab.title;
	const tabId = thisTab.id;
	//YOUTUBE// add time of video
	if (/youtube.com\/watch/.test(tabUrl)) {
		//We cannot run functions, like document.getElementById("movie_player").getCurrentTime(), but we can read values. So we have to use a roundabout method to get what we want; the best seems to be getting the aria-valuenow from ytp-progress-bar

		// As a video progresses, automatically adds
		chrome.scripting.executeScript({
			target: { tabId },
			func: getProgress
		});
	}

	chrome.storage.sync.get(function (storage: ABUStorage) {
		//NOT DONE YET: If the page is part of a higher domain that we ARE keeping track of but we don't have a direct domain for this one, let's go up some levels:

		ABUState.domain = checkLevels(storage, getWebpage(tabUrl, tabTitle, storage));

		// In case this gets changed elsewhere, keep it the same here
		const localDomain = ABUState.domain;

		//If this domain has an ABUkmark associated with it
		if (storage[localDomain]) {
			//Check that the bookmark hasn't been deleted
			chrome.bookmarks.search(
				"ABUid=" + storage[localDomain].ABUid,
				async function (targetABUkmark) {
					//console.log(targetABUkmark);

					//If the bookmark's gone
					if (!targetABUkmark || targetABUkmark.length === 0) {
						//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
						await chrome.storage.sync.remove(localDomain);
					} else {
						//If the bookmark's been found!
						//If you're saving for the comic pages, don't update bookmarks for the comic/archive pages. If this isn't a comics page, it'll run this too
						if (!(tabUrl.endsWith("/archive") && localDomain.endsWith("comic/"))) {
							//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
							await chrome.bookmarks.update(targetABUkmark[0].id, {
								title: `${tabTitle} (ABU)`,
								url: createABURL(tabUrl, storage[localDomain].ABUid)
							});

							//TESTING FAVICONS//
							//thisTab.url=ABURL;
							//chrome.bookmarks.update(targetABUkmark[0].id,{title:thisTab.title+' (ABU)',url:thisTab.url});

							//If this new tab is the active one, update the icon:
							if (thisTab.active) {
								await chrome.action.setIcon({ path: activeIcons });
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
