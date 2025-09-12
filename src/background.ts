//Icons
const activeIcons = { "128": "icons/128blue.png" };
const inactiveIcons = { "128": "icons/128gray.png" };
const ABUVersion = 1.4;

const ABUState = {
	url: "",
	domain: "",
	title: "",
	favIconUrl: "",
	warning: "", // Warn about home page ABUkmarks going everywhere if they're on the home page
	warningClass: ""
};

console.log(
	"May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P"
);

//Get the webpage to save the ABUkmark to
function getWebpage(url: string, title: string, storage: ABUStorage) {
	let output = "";
	//Ignore the last section of the URL every time

	//console.log(input);

	//Get everything up until 1) a numbered section (past the domain) or 2) a querystring
	const match = /(\S+\/\/+[^\/]+[^\d\?]+\/)+(?!$)/.exec(url);
	if (match) output = match[0];
	//console.log(output);

	//Remove http (and www too, if it's present)
	output = output.replace(/[^\/]+\/\/(www.)?/, "");

	//console.log(input,output);

	//Check for special key folders; go up to those
	/*
		/blog/
		/comic/
	*/
	const keywordCheck = /.+\/(blog|comic)\//.exec(output);
	if (keywordCheck) output = keywordCheck[0];

	//Check for indicative keywords; go up to those
	var indicativeCheck = /.+\/(?=season-|ep-|episode-|page-|p-)/.exec(output);
	if (indicativeCheck) output = indicativeCheck[0];

	/////////ODD-URL WEBSITES COMPATIBILITY/////////
	var oddUrl = null;

	//WEBTOONS// webtoons.com/language/genre/name/
	if (!oddUrl) oddUrl = /webtoons.com\/[^/]+\/[^/]+\/[^/]+\//.exec(url);

	//LEZHIM// lezhin.com/language/comic/title
	if (!oddUrl) oddUrl = /lezhin.com\/[^/]+\/comic\/[^/]+\//.exec(url);

	//MANGAHUB.IO// mangahub.com/chapter/title
	if (!oddUrl) oddUrl = /mangahub.io\/chapter\/[^/]+\//.exec(url);

	if (oddUrl) output = oddUrl[0];

	/////////SPECIAL WEBSITE COMPATIBILITY/////////
	let special = null;

	//TAPAS// tapas.io/episode/ (same for every comic; we have to test by title)
	//console.log(input);
	if (/tapas.io\/(series|episode)\//.test(url) && title) {
		//Either get the title if separated by :: or by |
		special = /.+(?=\s::)/.exec(title) || /.+(?=\s\|)/.exec(title);
		//After get one, get the first item:
		if (special) special = special[0];

		//The output needs to be tapas.io/ if we're in this situation, otherwise it'll mess up too often (with series/episode switching, other ABUkmarks on the "same level" but different comics)
		output = "tapas.io/";
	}

	let ytUrl = null;
	//YOUTUBE PLAYLIST// https://www.youtube.com/playlist?list=id
	if (/youtube.com\/.+list=/.test(url)) {
		//Get the playlist id
		ytUrl = /(?:\?|&)list=[^?&]*/.exec(url);
		if (ytUrl) special = ytUrl[0];
	} else if (/youtube.com\/watch\?v=[^?&]*/.test(url)) {
		//Get the video id and track time
		ytUrl = /(?:\?|&)v=[^?&]*/.exec(url);
		if (ytUrl) special = ytUrl[0];
	}

	//GOOGLE SHEETS PRESENTATION// https://docs.google.com/presentation/d/slideshow_id/relevant_stuff
	if (/docs.google.com\/presentation\/d\/.+\//.test(url)) {
		const gSheetUrl = /docs.google.com\/presentation\/d\/.+\//.exec(url);
		//Get the slideshow url
		if (gSheetUrl) special = gSheetUrl[0];
	}

	//console.log(special);

	//If a special, unusual value was passed:
	if (special) {
		//See if either the special exists, or a higher level does not exist; in either case, we'll use the special value
		if (storage[special] || !storage[checkLevels(storage, output)]) {
			output = special;
		}
	}

	//console.log(output);

	return output;
}

function checkLevels(storage: ABUStorage, inputURL: string) {
	//console.log("Looking for higher level...",object,input);

	var test = inputURL,
		output = inputURL;

	//If we're on a special-case website where the title is passed instead of the URL, return with it
	if (inputURL.indexOf("/") === -1) {
		//console.log("Returning!");
		return inputURL;
	}

	//Test up to 10 times for deeper names
	for (let i = 0; i < 10; i++) {
		//console.log(object[test]);

		//If it exists, return it
		if (storage[test]) {
			output = test;
			break;
		} //If it doesn't exist, run again

		//Remove a subpage block from the end
		test = test.substring(0, test.length - 1).substring(0, test.lastIndexOf("/") + 1);

		//If we run 10 times and don't find a new thing, we'll just use the original input
	}

	//console.log("Putting out "+output);

	return output;
}

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

function updateTabInfo(thisTab: chrome.tabs.Tab) {
	if (!thisTab.url || !thisTab.title) return;
	const tabUrl = thisTab.url;
	const tabTitle = thisTab.title;
	///Tab-specific code
	//YOUTUBE// add time of video
	if (/youtube.com\/watch/.test(tabUrl)) {
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
		`
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
						chrome.storage.sync.remove(localDomain);
					} else {
						//If the bookmark's been found!
						//If you're saving for the comic pages, don't update bookmarks for the comic/archive pages. If this isn't a comics page, it'll run this too
						if (!(tabUrl.endsWith("/archive") && localDomain.endsWith("comic/"))) {
							//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
							chrome.bookmarks.update(targetABUkmark[0].id, {
								title: `${tabTitle} (ABU)`,
								url: createABURL(tabUrl, storage[localDomain].ABUid)
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

//Warning when overwriting lower-level ABUkmarks
function overwriteWarning(bookmark: chrome.bookmarks.BookmarkTreeNode) {
	if (
		bookmark.title.indexOf(" (ABU)") !== -1 &&
		ABUState.warning.indexOf("overwrit") == -1
	) {
		ABUState.warningClass = "overwrite";
		ABUState.warning +=
			"<strong>Don't accidentally overwrite ABUkmarks deeper in the website!</strong> If you do it, do it on purpose. Any bookmarks ending in (ABU) are ABUkmarks.<br>";
	}
}

//Make an ABURL
function createABURL(inputURL: string, inputABUid: number) {
	//ABURL is the URL that ABU creates that specifies the bookmark is ABU; it just appends a querystring with the id
	return inputURL + (inputURL.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + inputABUid;
}

//Make an ABUkmark back into a regular bookmark
