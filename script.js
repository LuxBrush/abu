//Icons
const activeIcons = { 128: "icons/128blue.png" };
const inactiveIcons = { 128: "icons/128gray.png" };
const ABUVersion = 1.4;

//Call the variables here
let url = "";
let domain = "";
let title = "";
let favIconUrl = "";

//Warn about home page ABUkmarks going everywhere if they're on the home page
let warning = "";

console.log(
	"May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P"
);

//Get the webpage to save the ABUkmark to
/**
 *
 * @param {string} url - Input url
 * @param {string} title - Title of webpage
 * @param {ABUStorage} storage
 */
function getWebpage(url, title, storage) {
	//Ignore the last section of the URL every time

	// Check if URL starts with http or https
	if (url.startsWith("http://") || url.startsWith("https://")) {
		//Get everything up until 1) a numbered section (past the domain) or 2) a querystring
		const match = /(\S+\/\/+[^/]+[^\d?]+\/)+(?!$)/.exec(url);
		if (!match) {
			console.error("Invalid URL format: unable to extract domain pattern");
			return "";
		}
		let output = match[0];

		//Remove http (and www too, if it's present)
		if (output) output = output.replace(/[^/]+\/\/(www.)?/, "");
		else output = url.replace(/[^/]+\/\/(www.)?/, "");

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
		let oddURL = null;

		//WEBTOONS// webtoons.com/language/genre/name/
		if (!oddURL) oddURL = /webtoons.com\/[^/]+\/[^/]+\/[^/]+\//.exec(url);

		//LEZHIM// lezhin.com/language/comic/title
		if (!oddURL) oddURL = /lezhin.com\/[^/]+\/comic\/[^/]+\//.exec(url);

		//MANGAHUB.IO// mangahub.com/chapter/title
		if (!oddURL) oddURL = /mangahub.io\/chapter\/[^/]+\//.exec(url);

		if (oddURL) output = oddURL[0];

		/////////SPECIAL WEBSITE COMPATIBILITY/////////
		var special = null;

		//TAPAS// tapas.io/episode/ (same for every comic; we have to test by title)
		//console.log(input);
		if (/tapas.io\/(series|episode)\//.test(url) && title) {
			//Either get the title if separated by :: or by |
			const match = /.+(?=\s::)/.exec(title) || /.+(?=\s\|)/.exec(title);
			//After get one, get the first item:
			if (match) special = match[0];

			//The output needs to be tapas.io/ if we're in this situation, otherwise it'll mess up too often (with series/episode switching, other ABUkmarks on the "same level" but different comics)
			output = "tapas.io/";
		}

		//YOUTUBE PLAYLIST// https://www.youtube.com/playlist?list=id
		if (/youtube.com\/.+list=/.test(url)) {
			//Get the playlist id
			const match = /(?:\?|&)list=[^?&]*/.exec(url);
			if (match) special = match[0];
		} else if (/youtube.com\/watch\?v=[^?&]*/.test(url)) {
			//Get the video id and track time
			const match = /(?:\?|&)v=[^?&]*/.exec(url);
			if (match) special = match[0];
		}

		//GOOGLE SHEETS PRESENTATION// https://docs.google.com/presentation/d/slideshow_id/relevant_stuff
		if (/docs.google.com\/presentation\/d\/.+\//.test(url)) {
			//Get the slideshow url
			const match = /docs.google.com\/presentation\/d\/.+\//.exec(url);
			if (match) special = match[0];
		}

		//console.log(special);

		//If a special, unusual value was passed:
		if (special) {
			//See if either the special exists, or a higher level does not exist; in either case, we'll use the special value
			if (storage[special] || !storage[checkLevels(storage, output)]) {
				output = special;
			}
		}

		return output;
	} else {
		return "";
	}
}

/**
 *
 * @param {ABUStorage} storage
 * @param {string} testURL
 * @returns {string}
 */
function checkLevels(storage, testURL) {
	//console.log("Looking for higher level...",object,input);

	var test = testURL,
		output = testURL;

	//If we're on a special-case website where the title is passed instead of the URL, return with it
	if (testURL.indexOf("/") === -1) {
		//console.log("Returning!");
		return testURL;
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
		test = test
			.substring(0, test.length - 1)
			.substring(0, test.lastIndexOf("/") + 1);

		//If we run 10 times and don't find a new thing, we'll just use the original input
	}

	//console.log("Putting out "+output);

	return output;
}

//Any changes to the URL call this- even a querystring change
chrome.tabs.onUpdated.addListener(function (_tabId, changeInfo, updatedTab) {
	//Check for ABUids on loading (we don't want to wait until it finishes loading to check, in some cases that could take a while or the ABUid could break PHP or other web code)
	if (changeInfo.status == "loading") {
		//Save the URL without an ABUid
		if (!updatedTab.url) {
			console.error("Tab URL is undefined or null");
			return;
		}
		var newURL = updatedTab.url.replace(/(\?|&)ABUid.*/, "");

		//If the URL had an ABUid, remove it
		if (newURL !== updatedTab.url) {
			//console.log("Replace state and stuff");

			//Loads the page without the ABUid
			chrome.tabs.executeScript(updatedTab.id, {
				code: "location.replace('" + newURL + "');",
				runAt: "document_start",
			});

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
 *
 * @param {chrome.tabs.Tab} thisTab
 */
function updateTabInfo(thisTab) {
	if (!thisTab.url) {
		console.error("Tab URL is undefined or null");
		return;
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

	chrome.storage.sync.get(function (/** @type {ABUStorage} */ storage) {
		//NOT DONE YET: If the page is part of a higher domain that we ARE keeping track of but we don't have a direct domain for this one, let's go up some levels:
		if (!thisTab.url || !thisTab.title) {
			console.error("Tab URL or title is undefined or null");
			return;
		}

		domain = checkLevels(
			storage,
			getWebpage(thisTab.url, thisTab.title, storage)
		);

		// In case this gets changed elsewhere, keep it the same here
		var localDomain = domain;

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
						if (!thisTab.url) {
							console.error(
								"Tab URL is undefined or null in bookmark update process"
							);
							return;
						}
						//If the bookmark's been found!
						//If you're saving for the comic pages, don't update bookmarks for the comic/archive pages. If this isn't a comics page, it'll run this too
						if (
							!(
								thisTab.url.endsWith("/archive") &&
								localDomain.endsWith("comic/")
							)
						) {
							//Get the target ABUkmark's id and update that ABUkmark with this tab's URL
							chrome.bookmarks.update(targetABUkmark[0].id, {
								title: thisTab.title + " (ABU)",
								url: createABURL(thisTab.url, storage[localDomain]["ABUid"]),
							});

							//TESTING FAVICONS//
							//thisTab.url=ABURL;
							//chrome.bookmarks.update(targetABUkmark[0].id,{title:thisTab.title+' (ABU)',url:thisTab.url});

							//If this new tab is the active one, update the icon:
							if (thisTab.active) {
								chrome.browserAction.setIcon({ path: activeIcons });
							}
						}
					}
				}
			);
		} else {
			//If this webpage doesn't have an associated ABUkmark
			//If this new tab is the current one, update the icon:
			if (thisTab.active) {
				chrome.browserAction.setIcon({ path: inactiveIcons });
			}
		}
	});
}

/**
 *
 * @param {HTMLButtonElement} mainButton
 */
function createPage(mainButton) {
	chrome.storage.sync.get(function (/** @type {ABUStorage}} */ storage) {
		//ABUVersion info
		if (!storage["ABUVersion"] || storage["ABUVersion"] < ABUVersion) {
			document
				.getElementsByTagName("BODY")[0]
				.insertAdjacentHTML(
					"afterbegin",
					"<p id='update'>ABU 1.4 adds support for mangahub.io. Always feel free to let me know if ABU doesn't work on any website!</p>"
				);
			chrome.storage.sync.set({ ABUVersion: ABUVersion });
		}

		mainButton.dataset.multiple = "0";

		console.log("url is", url);

		//If we're on the homepage, warn the user that subpages are better
		if (
			// If all of these are true, the user's on a homepage
			(domain.indexOf("/") !== -1 &&
				domain.substr(0, domain.length - 2).indexOf("/") == -1 &&
				!/(page|p|date)=/i.test(url) &&
				!/tapas.io\/(series|episode)\//.test(url)) ||
			// If any of these are true, the user's on a homepage
			/mangahub.io\/manga\//.test(url)
		) {
			if (warning.indexOf("a subpage if") === -1)
				warning +=
					"ABUkmark a subpage if possible so visiting about, archives, links, etc doesn't update bookmarks. Just click on an article, a back button, or a button to start reading and it should be perfect!<br>";
		}

		let anywhereButtons = "";

		domain = checkLevels(storage, domain);

		//Setup buttons
		if (!storage[domain]) {
			//If we don't have an ABUkmark for this site
			chrome.bookmarks.search(domain, function (thisBookmark1) {
				let warningClass = "";
				if (thisBookmark1[0]) {
					//If the bookmark exists
					mainButton.innerHTML = "Convert to ABUkmark";
					mainButton.style.backgroundColor = "#9ccc5e";

					overwriteWarning(thisBookmark1[0], warningClass);

					setNotification(
						warning +
							"Will convert <em title='" +
							thisBookmark1[0].url +
							"'>" +
							thisBookmark1[0].title +
							"</em>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>",
						mainButton
					);
					if (thisBookmark1.length > 1) {
						let bookmarksChoose = "";

						//Create a dropdown so you can choose which to change
						for (let i = 0; i < thisBookmark1.length; i++) {
							warningClass = "";
							const bookmark = thisBookmark1[i];
							if (!bookmark.url || !bookmark.title) {
								console.error("Bookmark URL or title is undefined or null");
								return;
							}

							overwriteWarning(bookmark, warningClass);

							let dropdownDomain = checkLevels(
								storage,
								getWebpage(bookmark.url, bookmark.title, storage)
							); //checkLevels(thisBookmark1[i].url);

							//console.log(dropdownDomain);

							//Add a dropdown with the bookmarks info
							if (bookmark.title.indexOf(" (ABU)") == -1) {
								//If the bookmark is untitled, let the user know
								let thisBookmarkTitle = bookmark.title;
								if (thisBookmarkTitle == "") {
									thisBookmarkTitle = "(Untitled)";
								}

								bookmarksChoose +=
									"<option class='" +
									warningClass +
									"' title='" +
									thisBookmark1[i].url +
									"' data-domain='" +
									dropdownDomain +
									"' value='" +
									thisBookmark1[i].id +
									"'>" +
									thisBookmarkTitle +
									"</option>";
							} else {
								bookmarksChoose +=
									"<option class='overwrite' title='" +
									thisBookmark1[i].url +
									"' data-domain='" +
									dropdownDomain +
									"' value='" +
									thisBookmark1[i].id +
									"'>" +
									thisBookmark1[i].title +
									"</option>";
							}
						}
						setNotification(
							warning +
								thisBookmark1.length +
								" bookmarks spotted. Will convert <select>" +
								bookmarksChoose +
								"</select>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>",
							mainButton
						);
						mainButton.dataset.multiple = "1";
					}
				} else {
					//If it doesn't
					//Change the button's text and color
					mainButton.innerHTML = "Create ABUkmark";
					mainButton.style.backgroundColor = "#619919";
					//Set the notification if there's a warning
					if (warning !== "") {
						setNotification(warning, mainButton);
					}
				}
				mainButton.onclick = function () {
					ABU(domain, false, mainButton);
				};
			});
		} else {
			//If we have an ABUkmark for this, according to our data
			chrome.bookmarks.search(
				"ABUid=" + storage[domain]["ABUid"],
				function (thisBookmark2) {
					if (!thisBookmark2) {
						chrome.storage.sync.remove(domain);
					} else {
						let check = false;
						for (const bookmark of thisBookmark2) {
							if (!bookmark.url || !bookmark.title) {
								console.error("Bookmark URL or title is undefined or null");
								return;
							}
							if (
								domain === getWebpage(bookmark.url, bookmark.title, storage)
							) {
								check = true;
							}
						}

						//GO THROUGH THE FOR LOOP (otherwise won't work with multiple pages and if in a higher-level domain; need to check for that)

						if (thisBookmark2[0] && check) {
							//If we've found out the bookmark claimed to exist does, set the button so that:
							mainButton.innerHTML = "Revert to normal bookmark";
							mainButton.style.backgroundColor = "#f00";
							mainButton.onclick = function () {
								unABU(domain, storage[domain]["ABUid"], mainButton);
								chrome.browserAction.setIcon({ path: inactiveIcons });
							};
						} else {
							chrome.storage.sync.remove(domain);
							mainButton.innerHTML = "Create ABUkmark";
							mainButton.style.backgroundColor = "#619919";
							mainButton.onclick = function () {
								ABU(domain, false, mainButton);
							};
						}
					}
				}
			);
		}

		var bookmarks = Object.keys(storage);

		//Create buttons for removing ABUkmarks
		for (let i = 0; i < bookmarks.length; i++) {
			//Don't create a button for the webpage domain we're on
			//Don't create a button for the ABUVersion object, which checks the current version in use.
			if (bookmarks[i] == domain || bookmarks[i] == "ABUVersion") {
				continue;
			}

			//Look for the bookmarks as we go through the list, to make sure they still exist.
			chrome.bookmarks.search(
				"ABUid=" + storage[bookmarks[i]]["ABUid"],
				function (thisBookmark3) {
					//console.log(storage[bookmarks[i]]["ABUid"],"Bookmark is: ",thisBookmark3,thisBookmark3.length);

					//If a bookmark in the list doesn't exist
					if (thisBookmark3.length === 0) {
						const ABUid = storage[bookmarks[i]]["ABUid"];
						const ABUButton = document.querySelector(
							'button[data-id="' + ABUid + '"]'
						);

						//Remove the info
						chrome.storage.sync.remove(bookmarks[i]);

						//Remove the element, if it exists
						if (ABUButton) ABUButton.remove();
					}
				}
			);

			//Add the button if it exists
			anywhereButtons +=
				"<button data-id='" +
				storage[Object.keys(storage)[i]]["ABUid"] +
				"' data-domain='" +
				Object.keys(storage)[i] +
				"'>&times; <img src='" +
				storage[Object.keys(storage)[i]]["favIconUrl"] +
				"'> " +
				Object.keys(storage)[i] +
				"</button>";
		}

		//If the user doesn't have any ABUkmarks, don't show the horizontal rule
		if (anywhereButtons == "") {
			document.getElementsByTagName("hr")[0].style.display = "none";
		}

		console.log(
			"Any favicons not found will produce errors below (it's not really worth worrying about)"
		);

		const abuAnywhereDiv = document.getElementById("abu-anywhere");
		if (!abuAnywhereDiv) {
			console.error("abu-anywhere element not found in DOM");
			return;
		}
		abuAnywhereDiv.innerHTML = anywhereButtons;

		var buttons = /** @type {HTMLCollectionOf<HTMLButtonElement>} */ (
			abuAnywhereDiv.children
		);
		var images = document.getElementsByTagName("img");

		//Add functions for each button
		for (let ii = 0; ii < buttons.length; ii++) {
			const button = buttons[ii];
			const image = images[ii];
			button.onclick = function () {
				if (!button.dataset.domain || !button.dataset.id) {
					return;
				}
				unABU(button.dataset.domain, parseInt(button.dataset.id), mainButton);
			};

			//Hide any images that fail to load properly
			image.onerror = function () {
				image.style = "display:none;";
			};
		}
	});
}

//Warning when overwriting lower-level ABUkmarks
/**
 *
 * @param {chrome.bookmarks.BookmarkTreeNode} bookmark
 * @param {string} warningClass
 */
function overwriteWarning(bookmark, warningClass) {
	if (
		bookmark.title.indexOf(" (ABU)") !== -1 &&
		warning.indexOf("overwrit") == -1
	) {
		warningClass = "overwrite";
		warning +=
			"<strong>Don't accidentally overwrite ABUkmarks deeper in the website!</strong> If you do it, do it on purpose. Any bookmarks ending in (ABU) are ABUkmarks.<br>";
	}
}

/**
 *
 * @param {string} url
 * @param {boolean} mustMakeNew
 * @param {HTMLButtonElement} mainButton
 */
function ABU(url, mustMakeNew, mainButton) {
	let inArray = 0;
	let inArrayDomain = "";

	if (mainButton.dataset.multiple === "1") {
		const selectElement = /** @type {HTMLSelectElement} */ (
			document.getElementsByTagName("SELECT")[0]
		);
		inArray = selectElement.selectedIndex;

		//Get the bookmark to change with this:
		const selectOption = selectElement.options[selectElement.selectedIndex];
		if (!selectOption.dataset.domain) {
			console.error("Selected option is missing domain data");
			return;
		}
		if (selectOption.className !== "") {
			inArrayDomain = selectOption.dataset.domain;
		}
	}

	chrome.bookmarks.search(url, function (thisBookmark) {
		if (!thisBookmark[inArray] || mustMakeNew) {
			//If the bookmark doesn't exist

			//Check for ABUkmarks folder, add if doesn't exist
			chrome.bookmarks.search("ABUkmarks", function (thisFolder) {
				if (!thisFolder[0]) {
					//If folder ABUkmarks doesn't exist
					chrome.bookmarks.create({ title: "ABUkmarks" }, function (newFolder) {
						createABUkmark(url, newFolder.id);
					});
				} else {
					//If the folder exists
					createABUkmark(url, thisFolder[0].id);
				}
				//Not always located there; get exact location and state it
				setNotification(
					"New ABUkmark located in <em>Other bookmarks &#8594; ABUkmarks</em>",
					mainButton
				);
			});
		} else {
			//If the bookmark exists

			if (inArrayDomain !== "") {
				chrome.storage.sync.remove(inArrayDomain);
			}

			var ABUid = Date.now();

			storeObj(url, ABUid, mainButton);

			chrome.bookmarks.update(thisBookmark[inArray].id, {
				title: title + " (ABU)",
				url: createABURL(url, ABUid),
			});

			setNotification("", mainButton);
		}
	});

	chrome.browserAction.setIcon({ path: activeIcons });
}

//Create a new bookmark to be an ABUkmark
/**
 *
 * @param {string} url
 * @param {string} parentId
 */
function createABUkmark(url, parentId) {
	const ABUid = Date.now();
	chrome.bookmarks.create(
		{
			parentId: parentId,
			title: title + " (ABU)",
			url: createABURL(url, ABUid),
		},
		function (newBookmark) {
			storeObj(url, ABUid, getMainButton());
		}
	);
}

//Make an ABURL
/**
 *
 * @param {string} inputURL
 * @param {number} inputABUid
 * @returns {string}
 */
function createABURL(inputURL, inputABUid) {
	//ABURL is the URL that ABU creates that specifies the bookmark is ABU; it just appends a querystring with the id
	return (
		inputURL + (inputURL.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + inputABUid
	);
}

/**
 *
 * @param {string} input
 * @param {HTMLButtonElement} mainButton
 */
function setNotification(input, mainButton) {
	const notification = document.getElementById("notification");
	if (!notification) {
		console.error("Notification element not found");
		return;
	}
	notification.innerHTML = input;
	const onlyNewABU = document.getElementById("onlyNewABU");

	if (onlyNewABU) {
		onlyNewABU.onclick = function () {
			ABU(domain, true, mainButton);
		};
	}

	notification.style.display = input !== "" ? "block" : "none";
}

//Stores an object in the user's synced data
/**
 *
 * @param {string} ABUURL
 * @param {number} bookmarkId
 * @param {HTMLButtonElement} mainButton
 */
function storeObj(ABUURL, bookmarkId, mainButton) {
	/** @type {ABUStorage} */
	const storageUpdate = {};
	storageUpdate[ABUURL] = { ABUid: bookmarkId, favIconUrl: favIconUrl };
	chrome.storage.sync.set(storageUpdate);
	createPage(mainButton);
}

//Make an ABUkmark back into a regular bookmark
/**
 *
 * @param {string} setUrl
 * @param {number} setId
 * @param {HTMLButtonElement} mainButton
 */
function unABU(setUrl, setId, mainButton) {
	//Get the bookmark
	chrome.bookmarks.search("ABUid=" + setId, function (targetABUkmark) {
		const bookmark = targetABUkmark[0];
		if (!bookmark.url || !bookmark.title) {
			console.error("Bookmark URL or title is undefined or null");
			return;
		}
		//Remove the ABU tag
		chrome.bookmarks.update(bookmark.id, {
			url: bookmark.url.replace(/(\?|&)ABUid=[0-9]+/g, ""),
			title: bookmark.title.replace(" (ABU)", ""),
		});
	});
	chrome.storage.sync.remove(setUrl, function () {
		setNotification("", mainButton);
		createPage(mainButton);
	});
}

function getMainButton() {
	const mainButton = /** @type {HTMLButtonElement} */ (
		document.getElementById("current-page")
	);
	if (!mainButton) {
		console.error("");
		const newMainButton = document.createElement("button");
		newMainButton.id = "current-page";
		const body = document.getElementById("ABUSETUP");
		if (!body) {
			throw new Error("Body element with id 'ABUSETUP' not found");
		}
		body.append(newMainButton);
		return newMainButton;
	}
	return mainButton;
}

//Run a popup's element is present, run the popup script!
if (document.getElementById("current-page")) {
	console.log("ABU popup loaded!");

	//Have notifications depending on what's done

	const mainButton = getMainButton();
	mainButton.dataset.multiple = "0";

	//Get URL
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		//console.log(tabs);
		//Need to get storage here, for getting the webpage
		chrome.storage.sync.get(function (/** @type {ABUStorage} */ storage) {
			const tab = tabs[0];
			if (!tab.url || !tab.title || !tab.favIconUrl) {
				console.error("Tab URL, title, or favicon URL is undefined or null");
				return;
			}
			url = tab.url;
			domain = getWebpage(url, tab.title, storage);
			title = tab.title;
			favIconUrl = tab.favIconUrl;

			createPage(mainButton);
		});
	});
}
