import { activeIcons, inactiveIcons, ABUVersion, ABUState } from "./common.js";

/** @type {HTMLButtonElement} */
let mainButton;

//Warn about home page ABUkmarks going everywhere if they're on the home page

console.log(
	"May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P"
);

/**
 * Get the webpage domain/path to save the ABUkmark to
 * @param {string} inputUrl - The URL of the current tab
 * @param {string} title - The title of the current tab
 * @param {ABUStorage} storage - The extension's storage object
 * @returns {string | null} The normalized domain/path or special token to use as a scope key
 */
function getWebpage(inputUrl, title, storage) {
	// Check if inputUrl is an http or https URL
	if (!/^https?:\/\//.test(inputUrl)) {
		return null;
	}
	//Ignore the last section of the URL every time
	let output = "";

	//Get everything up until 1) a numbered section (past the domain) or 2) a querystring
	const domainPath = inputUrl.match(/(\S+\/\/+[^/]+[^\d?]+\/)+(?!$)/);
	if (domainPath) output = domainPath[0];

	//Remove http (and www too, if it's present)
	output = output.replace(/[^/]+\/\/(www.)?/, "");

	//Check for special key folders; go up to those
	/*
		/blog/
		/comic/
	*/
	const keywordCheck = output.match(/.+\/(blog|comic)\//);
	if (keywordCheck) output = keywordCheck[0];

	//Check for indicative keywords; go up to those
	const indicativeCheck = output.match(/.+\/(?=season-|ep-|episode-|page-|p-)/);
	if (indicativeCheck) output = indicativeCheck[0];

	/////////ODD-URL WEBSITES COMPATIBILITY/////////
	// Single-pass match for known odd patterns
	const oddUrl = inputUrl.match(
		/(?:webtoons\.com\/[^/]+\/[^/]+\/[^/]+\/|lezhin\.com\/[^/]+\/comic\/[^/]+\/|mangahub\.io\/chapter\/[^/]+\/)/
	);
	if (oddUrl) output = oddUrl[0];

	/////////SPECIAL WEBSITE COMPATABILITY/////////
	let special = null;

	//TAPAS// tapas.io/episode/ (same for every comic; we have to test by title)
	//console.log(input);
	if (/tapas.io\/(series|episode)\//.test(inputUrl) && title) {
		//Either get the title if separated by :: or by |
		special = title.match(/.+(?=\s::)/) || title.match(/.+(?=\s\|)/);
		if (!special) {
			console.error("Unable to extract title from Tapas page");
			return null;
		}
		//After get one, get the first item:
		special = special[0];

		//The output needs to be tapas.io/ if we're in this situation, otherwise it'll mess up too often (with series/episode switching, other ABUkmarks on the "same level" but different comics)
		output = "tapas.io/";
	}

	//YOUTUBE PLAYLIST// https://www.youtube.com/playlist?list=id
	if (/youtube.com\/.+list=/.test(inputUrl)) {
		//Get the playlist id
		const match = inputUrl.match(/(?:\?|&)list=[^?&]*/);
		if (!match) {
			console.error("Unable to extract playlist id from YouTube page");
			return null;
		}
		special = match[0];
	} else if (/youtube.com\/watch\?v=[^?&]*/.test(inputUrl)) {
		//Get the video id and track time
		const match = inputUrl.match(/(?:\?|&)v=[^?&]*/);
		if (!match) {
			console.error("Unable to extract video id from YouTube page");
			return null;
		}
		special = match[0];
	}

	//GOOGLE SHEETS PRESENTATION// https://docs.google.com/presentation/d/slideshow_id/relevant_stuff
	if (/docs.google.com\/presentation\/d\/.+\//.test(inputUrl)) {
		//Get the slideshow url
		const match = inputUrl.match(/docs.google.com\/presentation\/d\/.+\//);
		if (!match) {
			console.error("Unable to extract slideshow url from Google Sheets page");
			return null;
		}
		special = match[0];
	}

	//If a special, unusual value was passed:
	if (special) {
		//See if either the special exists, or a higher level does not exist; in either case, we'll use the special value
		if (storage[special] || !storage[checkLevels(storage, output)]) {
			output = special;
		}
	}

	return output;
}

/**
 * Checks for higher level ABUkmarks
 * @param {ABUStorage} storage The extension's storage object
 * @param {string} urlOrTitle The URL or title to check
 * @returns {string}
 */
function checkLevels(storage, urlOrTitle) {
	var test = urlOrTitle,
		output = urlOrTitle;

	//If we're on a special-case website where the title is passed instead of the URL, return with it
	if (urlOrTitle.indexOf("/") === -1) {
		return urlOrTitle;
	}

	//Test up to 10 times for deeper names
	for (let i = 0; i < 10; i++) {
		//If it exists, return it
		if (storage[test]) {
			output = test;
			break;
		} //If it doesn't exist, run again

		//Remove a subpage block from the end
		test = test.substr(0, test.length - 1).substr(0, test.lastIndexOf("/") + 1);

		//If we run 10 times and don't find a new thing, we'll just use the original input
	}

	return output;
}

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

function createPage() {
	chrome.storage.sync.get(function (/** @type {ABUStorage} */ storage) {
		//ABUVersion info
		if (!storage.ABUVersion || storage.ABUVersion < ABUVersion) {
			document
				.getElementsByTagName("BODY")[0]
				.insertAdjacentHTML(
					"afterbegin",
					"<p id='update'>ABU 1.4 adds support for mangahub.io. Always feel free to let me know if ABU doesn't work on any website!</p>"
				);
			chrome.storage.sync.set({ ABUVersion: ABUVersion });
		}

		mainButton.dataset.multiple = "0";
		//console.log(domain,domain.substr(0,domain.length-2).indexOf("/")==-1);

		console.log("url is", ABUState.url);

		//If we're on the homepage, warn the user that subpages are better
		if (
			// If all of these are true, the user's on a homepage
			(ABUState.domain.indexOf("/") !== -1 &&
				ABUState.domain.substr(0, ABUState.domain.length - 2).indexOf("/") ==
					-1 &&
				!/(page|p|date)=/i.test(ABUState.url) &&
				!/tapas.io\/(series|episode)\//.test(ABUState.url)) ||
			// If any of these are true, the user's on a homepage
			/mangahub.io\/manga\//.test(ABUState.url)
		) {
			if (ABUState.warning.indexOf("a subpage if") === -1)
				ABUState.warning +=
					"ABUkmark a subpage if possible so visiting about, archives, links, etc doesn't update bookmarks. Just click on an article, a back button, or a button to start reading and it should be perfect!<br>";
		}

		let anywhereButtons = "";

		ABUState.domain = checkLevels(storage, ABUState.domain);

		//Setup buttons
		if (!storage[ABUState.domain]) {
			//If we don't have an ABUkmark for this site
			chrome.bookmarks.search(ABUState.domain, function (bookmarkNode) {
				const firstBookmark = bookmarkNode[0];
				if (firstBookmark) {
					//If the bookmark exists
					mainButton.innerHTML = "Convert to ABUkmark";
					mainButton.style.backgroundColor = "#9ccc5e";

					overwriteWarning(firstBookmark);

					setNotification(
						ABUState.warning +
							"Will convert <em title='" +
							bookmarkNode[0].url +
							"'>" +
							bookmarkNode[0].title +
							"</em>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>"
					);
					if (bookmarkNode.length > 1) {
						let bookmarksChoose = "";

						ABUState.warningClass = "";

						//Create a dropdown so you can choose which to change
						for (let i = 0; i < bookmarkNode.length; i++) {
							ABUState.warningClass = "";
							const bookmark = bookmarkNode[1];
							if (!bookmark.url || !bookmark.title) continue;

							overwriteWarning(bookmark);
							const path = getWebpage(bookmark.url, bookmark.title, storage);
							if (!path) continue;

							let dropdownDomain = checkLevels(storage, path);

							//console.log(dropdownDomain);

							//Add a dropdown with the bookmarks info
							if (bookmarkNode[i].title.indexOf(" (ABU)") == -1) {
								//If the bookmark is untitled, let the user know
								let thisBookmarkTitle = bookmarkNode[i].title;
								if (thisBookmarkTitle == "") {
									thisBookmarkTitle = "(Untitled)";
								}

								bookmarksChoose +=
									"<option class='" +
									ABUState.warningClass +
									"' title='" +
									bookmarkNode[i].url +
									"' data-domain='" +
									dropdownDomain +
									"' value='" +
									bookmarkNode[i].id +
									"'>" +
									thisBookmarkTitle +
									"</option>";
							} else {
								bookmarksChoose +=
									"<option class='overwrite' title='" +
									bookmarkNode[i].url +
									"' data-domain='" +
									dropdownDomain +
									"' value='" +
									bookmarkNode[i].id +
									"'>" +
									bookmarkNode[i].title +
									"</option>";
							}
						}
						setNotification(
							ABUState.warning +
								bookmarkNode.length +
								" bookmarks spotted. Will convert <select>" +
								bookmarksChoose +
								"</select>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>"
						);
						mainButton.dataset.multiple = "1";
					}
				} else {
					//If it doesn't
					//Change the button's text and color
					mainButton.innerHTML = "Create ABUkmark";
					mainButton.style.backgroundColor = "#619919";
					//Set the notification if there's a warning
					if (ABUState.warning !== "") {
						setNotification(ABUState.warning);
					}
				}
				mainButton.onclick = function () {
					ABU(ABUState.domain);
				};
			});
		} else {
			//If we have an ABUkmark for this, according to our data
			chrome.bookmarks.search(
				"ABUid=" + storage[ABUState.domain].ABUid,
				function (thisBookmark2) {
					if (!thisBookmark2) {
						chrome.storage.sync.remove(ABUState.domain);
					} else {
						let check = false;
						for (let i = 0; i < thisBookmark2.length; i++) {
							const bookmark = thisBookmark2[i];
							if (!bookmark.url || !bookmark.title) continue;
							const path = getWebpage(bookmark.url, bookmark.title, storage);
							if (!path) continue;
							if (bookmark && ABUState.domain === checkLevels(storage, path)) {
								check = true;
							}
						}

						//GO THROUGH THE FOR LOOP (otherwise won't work with multiple pages and if in a higher-level domain; need to check for that)

						if (thisBookmark2[0] && check) {
							//If we've found out the bookmark claimed to exist does, set the button so that:
							mainButton.innerHTML = "Revert to normal bookmark";
							mainButton.style.backgroundColor = "#f00";
							mainButton.onclick = function () {
								unABU(ABUState.domain, storage[ABUState.domain].ABUid);
								chrome.action.setIcon({ path: inactiveIcons });
							};
						} else {
							chrome.storage.sync.remove(ABUState.domain);
							mainButton.innerHTML = "Create ABUkmark";
							mainButton.style.backgroundColor = "#619919";
							mainButton.onclick = function () {
								ABU(ABUState.domain);
							};
						}
					}
				}
			);
		}

		const bookmarks = Object.keys(storage);

		//Create buttons for removing ABUkmarks
		for (let i = 0; i < bookmarks.length; i++) {
			//Don't create a button for the webpage domain we're on
			//Don't create a button for the ABUVersion object, which checks the current version in use.
			if (bookmarks[i] == ABUState.domain || bookmarks[i] == "ABUVersion") {
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
							`button[data-id="${ABUid}"]`
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
				storage[Object.keys(storage)[i]].ABUid +
				"' data-domain='" +
				Object.keys(storage)[i] +
				"'>&times; <img src='" +
				storage[Object.keys(storage)[i]].favIconUrl +
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

		const abuAnywhereDiv = /** @type {HTMLDivElement} */ (
			document.getElementById("abu-anywhere")
		);
		if (!abuAnywhereDiv) return;

		abuAnywhereDiv.innerHTML = anywhereButtons;

		const buttons = abuAnywhereDiv.getElementsByTagName("button");
		const images = abuAnywhereDiv.getElementsByTagName("img");

		//Add functions for each button
		for (let ii = 0; ii < buttons.length; ii++) {
			const button = buttons[ii];
			if (!button.dataset.domain || !button.dataset.id) continue;
			const image = images[ii];
			button.onclick = function () {
				const domain = button.dataset.domain;
				const id = button.dataset.id;
				if (!domain || !id) return;
				unABU(domain, parseInt(id));
			};

			//Hide any images that fail to load properly
			image.onerror = function () {
				image.style = "display:none;";
			};
		}
	});
}

/**
 * Warns the user if they might accidentally overwrite existing ABUkmarks deeper in the website
 * @param {chrome.bookmarks.BookmarkTreeNode} bookmark - The bookmark to check for ABU status
 */
function overwriteWarning(bookmark) {
	if (
		bookmark.title.indexOf(" (ABU)") !== -1 &&
		ABUState.warning.indexOf("overwrit") == -1
	) {
		ABUState.warningClass = "overwrite";
		ABUState.warning +=
			"<strong>Don't accidentally overwrite ABUkmarks deeper in the website!</strong> If you do it, do it on purpose. Any bookmarks ending in (ABU) are ABUkmarks.<br>";
	}
}

/**
 * Creates or converts an ABUkmark for the given domain
 * @param {string} domainPath - The domain/path to bookmark
 * @param {boolean} [createNew=false] - True to force new bookmark creation
 */
function ABU(domainPath, createNew = false) {
	let inArray = 0;
	let inArrayDomain = "";

	if (mainButton.dataset.multiple === "1") {
		const selectCollection = /** @type {HTMLCollectionOf<HTMLSelectElement>} */ (
			document.getElementsByTagName("SELECT")
		);
		const selectElement = selectCollection[0];
		inArray = selectElement.selectedIndex;

		//Get the bookmark to change with this:
		if (selectElement.options[selectElement.selectedIndex].className !== "") {
			const selectDomain =
				selectElement.options[selectElement.selectedIndex].dataset.domain;
			if (selectDomain) inArrayDomain = selectDomain;
		}
	}

	chrome.bookmarks.search(domainPath, function (thisBookmark) {
		if (!thisBookmark[inArray] || createNew) {
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
				setNotification(
					"New ABUkmark located in <em>Other bookmarks &#8594; ABUkmarks</em>"
				);
			});
		} else {
			//If the bookmark exists

			if (inArrayDomain !== "") {
				chrome.storage.sync.remove(inArrayDomain);
			}

			var ABUid = Date.now();

			storeObj(domainPath, ABUid);

			chrome.bookmarks.update(thisBookmark[inArray].id, {
				title: ABUState.title + " (ABU)",
				url: createABURL(ABUState.url, ABUid),
			});

			setNotification("");
		}
	});

	chrome.action.setIcon({ path: activeIcons });
}

/**
 * Creates an ABUkmark (a special bookmark) and stores it in the specified folder.
 * @param {string} domainPath - The domain path to store in the ABUkmark data.
 * @param {string} parentId - The ID of the parent folder where the ABUkmark will be created.
 */
function createABUkmark(domainPath, parentId) {
	const ABUid = Date.now();
	chrome.bookmarks.create(
		{
			parentId,
			title: `${ABUState.title} (ABU)`,
			url: createABURL(ABUState.url, ABUid),
		},
		function () {
			storeObj(domainPath, ABUid);
		}
	);
}

/**
 * Append the ABU identifier to a URL for bookmarking.
 * Adds `ABUid` as a query param, preserving any existing query string.
 * Used to tag ABUkmarks; `ABUid` is later searched and stripped on load.
 * @param {string} url - Source URL to tag.
 * @param {number} ABUid - Unique bookmark id (e.g., Date.now()).
 * @returns {string} URL with the `ABUid` parameter appended.
 */
function createABURL(url, ABUid) {
	//ABURL is the URL that ABU creates that specifies the bookmark is ABU; it just appends a querystring with the id
	return url + (url.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + ABUid;
}

/**
 * Update the popup notification UI.
 * Sets the `#notification` HTML, toggles visibility, and binds
 * `#onlyNewABU` click (when present) to create a new ABUkmark.
 * @param {string} inputHTML - HTML to render; empty hides the notification.
 * @returns {void}
 */
function setNotification(inputHTML) {
	const notification = document.getElementById("notification");
	if (!notification) return;
	notification.innerHTML = inputHTML;

	const onlyNewABU = document.getElementById("onlyNewABU");
	if (onlyNewABU) {
		onlyNewABU.onclick = function () {
			ABU(ABUState.domain, true);
		};
	}

	notification.style.display = inputHTML !== "" ? "block" : "none";
}

/**
 * Persist one ABUkmark entry to storage under its scope key.
 * Keeps the shape expected elsewhere: { ABUid, favIconUrl }.
 * @param {string} scopeKey - Normalized domain/path or special token.
 * @param {number} ABUid - Unique bookmark id.
 */
function storeObj(scopeKey, ABUid) {
	// Guard against empty keys
	if (!scopeKey) return;

	/** @type {ABUEntry} */
	const entry = {
		ABUid,
		favIconUrl: ABUState.favIconUrl,
	};

	chrome.storage.sync.set({ [scopeKey]: entry });
	createPage();
}

/**
 * Make an ABUkmark back into a regular bookmark.
 * @param {string} url - Scope key to remove from storage.
 * @param {number} ABUid - ABU id associated with the bookmark.
 */
function unABU(url, ABUid) {
	//Get the bookmark
	chrome.bookmarks.search("ABUid=" + ABUid, function (targetABUkmark) {
		const node = targetABUkmark && targetABUkmark[0];
		if (!node || !node.url || !node.title) return;
		//Remove the ABU tag
		chrome.bookmarks.update(node.id, {
			url: node.url.replace(/(\?|&)ABUid=[0-9]+/g, ""),
			title: node.title.replace(" (ABU)", ""),
		});
	});
	chrome.storage.sync.remove(url, function () {
		setNotification("");
		createPage();
	});
}

//Run a popup's element is present, run the popup script!
if (document.getElementById("current-page")) {
	console.log("ABU popup loaded!");

	//Have notifications depending on what's done
	const mainButtonCheck = /** @type {HTMLButtonElement | null} */ (
		document.getElementById("current-page")
	);
	if (!mainButtonCheck) {
		throw new Error("Main button element not found");
	}
	mainButton = mainButtonCheck;
	mainButton.dataset.multiple = "0";

	//Get URL
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		//Need to get storage here, for getting the webpage
		chrome.storage.sync.get(function (/** @type {ABUStorage} */ storage) {
			const tab = tabs[0];
			if (!tab.url || !tab.title || !tab.favIconUrl) return;

			const path = getWebpage(tab.url, tab.title, storage);
			if (!path) return;

			ABUState.url = tab.url;
			ABUState.domain = path;
			ABUState.title = tab.title;
			ABUState.favIconUrl = tab.favIconUrl;

			createPage();
		});
	});
}
