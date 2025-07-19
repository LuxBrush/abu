const comms = chrome.runtime.connect(undefined, { name: "comms" });

// Create the Get utilities instance
const Get = createGetUtilities();

//Icons
const activeIcons = { "128": "icons/128blue.png" };
const inactiveIcons = { "128": "icons/128gray.png" };
const ABUVersion = 1.4;

const mainButton = Get.elementByID("current-page");

//Call the variables here
let url = "";
let domain = "";
let title = "";
let favIconUrl = "";

//Warn about home page ABUkmarks going everywhere if they're on the home page
let warning = "";

console.log("May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P");

//Get the webpage to save the ABUkmark to
function getWebpage(input, title, storage) {
	//Ignore the last section of the URL every time

	//console.log(input);

	//Get everything up until 1) a numbered section (past the domain) or 2) a querystring
	let output = /(\S+\/\/+[^\/]+[^\d\?]+\/)+(?!$)/.exec(input);
	//console.log(output);

	//Remove http (and www too, if it's present)
	if (output) output = output[0].replace(/[^\/]+\/\/(www.)?/, "");
	else output = input.replace(/[^\/]+\/\/(www.)?/, "");

	//console.log(input,output);

	//Check for special key folders; go up to those
	/*
		/blog/
		/comic/
	*/
	let keywordCheck = /.+\/(blog|comic)\//.exec(output);
	if (keywordCheck) output = keywordCheck[0];

	//Check for indicative keywords; go up to those
	let indicativeCheck = /.+\/(?=season-|ep-|episode-|page-|p-)/.exec(output);
	if (indicativeCheck) output = indicativeCheck[0];

	/////////ODD-URL WEBSITES COMPATABILITY/////////
	keywordCheck = null;

	//WEBTOONS// webtoons.com/language/genre/name/
	if (!keywordCheck) keywordCheck = /webtoons.com\/[^/]+\/[^/]+\/[^/]+\//.exec(input);

	//LEZHIM// lezhin.com/language/comic/title
	if (!keywordCheck) keywordCheck = /lezhin.com\/[^/]+\/comic\/[^/]+\//.exec(input);

	//MANGAHUB.IO// mangahub.com/chapter/title
	if (!keywordCheck) keywordCheck = /mangahub.io\/chapter\/[^/]+\//.exec(input);

	if (keywordCheck) output = keywordCheck[0];

	/////////SPECIAL WEBSITE COMPATABILITY/////////
	let special = null;

	//TAPAS// tapas.io/episode/ (same for every comic; we have to test by title)
	//console.log(input);
	if (/tapas.io\/(series|episode)\//.test(input) && title) {
		//Either get the title if separated by :: or by |
		special = /.+(?=\s::)/.exec(title) || /.+(?=\s\|)/.exec(title);
		//After get one, get the first item:
		special = special[0];

		//The output needs to be tapas.io/ if we're in this situation, otherwise it'll mess up too often (with series/episode switching, other ABUkmarks on the "same level" but different comics)
		output = "tapas.io/";
	}

	//YOUTUBE PLAYLIST// https://www.youtube.com/playlist?list=id
	if (/youtube.com\/.+list=/.test(input)) {
		//Get the playlist id
		special = /(?:\?|&)list=[^?&]*/.exec(input)[0];
	} else if (/youtube.com\/watch\?v=[^?&]*/.test(input)) {
		//Get the video id and track time
		special = /(?:\?|&)v=[^?&]*/.exec(input)[0];
	}

	//GOOGLE SHEETS PRESENTATION// https://docs.google.com/presentation/d/slideshow_id/relevant_stuff
	if (/docs.google.com\/presentation\/d\/.+\//.test(input)) {
		//Get the slideshow url
		special = /docs.google.com\/presentation\/d\/.+\//.exec(input)[0];
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

function checkLevels(object, input) {
	//console.log("Looking for higher level...",object,input);

	let test = input,
		output = input;

	//If we're on a special-case website where the title is passed instead of the URL, return with it
	if (input.indexOf("/") === -1) {
		//console.log("Returning!");
		return input;
	}

	//Test up to 10 times for deeper names
	for (let i = 0; i < 10; i++) {
		//console.log(object[test]);

		//If it exists, return it
		if (object[test]) {
			output = test;
			break;
		} //If it doesn't exist, run again

		//Remove a subpage block from the end
		test = test.substr(0, test.length - 1).substr(0, test.lastIndexOf("/") + 1);

		//If we run 10 times and don't find a new thing, we'll just use the original input
	}

	//console.log("Putting out "+output);

	return output;
}

//Any changes to the URL call this- even a querystring change
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, updatedTab) {
	//Check for ABUids on loading (we don't want to wait until it finishes loading to check, in some cases that could take a while or the ABUid could break PHP or other web code)
	if (changeInfo.status == "loading") {
		//console.log(updatedTab.url);

		//Save the URL without an ABUid
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

function updateTabInfo(thisTab) {
	///Tab-specific code
	//YOUTUBE// add time of video
	if (/youtube.com\/watch/.test(thisTab.url)) {
		//We cannot run functions, like document.getElementById("movie_player").getCurrentTime(), but we can read values. So we have to use a roundabout method to get what we want; the best seems to be getting the aria-valuenow from ytp-progress-bar

		// As a video progresses, automatically adds
		chrome.tabs.executeScript(thisTab.id, {
			allFrames: true,
			code: `
			if(!ABUYT){
				let ABUYT = setInterval(function(){
					// console.log('RUNNING INTERVAL');
					let progressBar = document.getElementsByClassName("ytp-progress-bar");
					
					if(!progressBar.length) return;
					
					// If a miniplayer is opened, we need to make sure we get the last element- that will be the main player.
					let newURL = window.location.href.replace(/&t=[^&]+|$/,"&t="+progressBar[progressBar.length-1].getAttribute("aria-valuenow"));
					
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

		/** @type {WebPageIdCommData} */
		const message = {
			functionName: "getWebPageId",
			properties: {
				url: thisTab.url,
				title: thisTab.title,
				storage,
			},
		};
		comms.postMessage(message);
		comms.onMessage.addListener((/** @type {string} */ returnMessage) => {
			if (returnMessage && returnMessage !== "") {
				domain = checkLevels(storage, returnMessage);
			}
		});

		// In case this gets changed elsewhere, keep it the same here
		let localDomain = domain;

		//If this domain has an ABUkmark associated with it
		if (storage[localDomain]) {
			//Check that the bookmark hasn't been deleted
			chrome.bookmarks.search("ABUid=" + storage[localDomain]["ABUid"], async function (targetABUkmark) {
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
						chrome.bookmarks.update(targetABUkmark[0].id, { title: thisTab.title + " (ABU)", url: createABURL(thisTab.url, storage[localDomain]["ABUid"]) });

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

function createPage() {
	chrome.storage.sync.get(function (/** @type {ABUStorage} */ storage) {
		//ABUVersion info
		if (!storage["ABUVersion"] || storage["ABUVersion"] < ABUVersion) {
			Get.elementByID("ABUSETUP").insertAdjacentHTML("afterbegin", "<p id='update'>ABU 1.4 adds support for mangahub.io. Always feel free to let me know if ABU doesn't work on any website!</p>");
			chrome.storage.sync.set({ "ABUVersion": ABUVersion });
		}

		mainButton.dataset.multiple = "0";

		// console.log("url is", url);

		//If we're on the homepage, warn the user that subpages are better
		if (
			// If all of these are true, the user's on a homepage
			(domain.indexOf("/") !== -1 && domain.substr(0, domain.length - 2).indexOf("/") == -1 && !/(page|p|date)=/i.test(url) && !/tapas.io\/(series|episode)\//.test(url)) ||
			// If any of these are true, the user's on a homepage
			/mangahub.io\/manga\//.test(url)
		) {
			if (warning.indexOf("a subpage if") === -1)
				warning += "ABUkmark a subpage if possible so visiting about, archives, links, etc doesn't update bookmarks. Just click on an article, a back button, or a button to start reading and it should be perfect!<br>";
		}

		let anywhereButtons = "";

		domain = checkLevels(storage, domain);

		//Setup buttons
		if (!storage[domain]) {
			//If we don't have an ABUkmark for this site
			chrome.bookmarks.search(domain, function (thisBookmark1) {
				if (thisBookmark1[0]) {
					//If the bookmark exists
					mainButton.innerHTML = "Convert to ABUkmark";
					mainButton.style.backgroundColor = "#9ccc5e";

					overwriteWarning(thisBookmark1[0]);

					setNotification(warning + "Will convert <em title='" + thisBookmark1[0].url + "'>" + thisBookmark1[0].title + "</em>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>");
					if (thisBookmark1.length > 1) {
						let bookmarksChoose = "";

						let warningClass = "";

						//Create a dropdown so you can choose which to change
						for (let i = 0; i < thisBookmark1.length; i++) {
							warningClass = "";
							let url = "";
							const bookmark = thisBookmark1[i];
							if (!bookmark.url) {
								throw new Error("Bookmark does not contain an URL.");
							}

							overwriteWarning(bookmark);

							/** @type {WebPageIdCommData} */
							const message = {
								functionName: "getWebPageId",
								properties: {
									url: bookmark.url,
									title: bookmark.title,
									storage,
								},
							};
							comms.postMessage(message);
							comms.onMessage.addListener((/** @type {string} */ returnMessage) => {
								if (returnMessage && returnMessage !== "") {
									url = returnMessage;
								}
							});
							const dropdownDomain = checkLevels(storage, url);

							//console.log(dropdownDomain);

							//Add a dropdown with the bookmarks info
							if (bookmark.title.indexOf(" (ABU)") == -1) {
								//If the bookmark is untitled, let the user know
								let thisBookmarkTitle = bookmark.title;
								if (thisBookmarkTitle == "") {
									thisBookmarkTitle = "(Untitled)";
								}

								bookmarksChoose += "<option class='" + warningClass + "' title='" + bookmark.url + "' data-domain='" + dropdownDomain + "' value='" + bookmark.id + "'>" + thisBookmarkTitle + "</option>";
							} else {
								bookmarksChoose += "<option class='overwrite' title='" + bookmark.url + "' data-domain='" + dropdownDomain + "' value='" + bookmark.id + "'>" + bookmark.title + "</option>";
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
			//If we have an ABUkmark for this, according to our data
			chrome.bookmarks.search("ABUid=" + storage[domain]["ABUid"], function (existingABUBookmarks) {
				if (!existingABUBookmarks) {
					chrome.storage.sync.remove(domain);
				} else {
					let matchingBookmarkIndex = 0;

					for (let bookmarkIndex = 0; bookmarkIndex < existingABUBookmarks.length; bookmarkIndex++) {
						let domainLevel = "";

						const currentBookmark = existingABUBookmarks[bookmarkIndex];
						if (!currentBookmark.url) {
							console.error("Bookmark", currentBookmark);
							throw new Error("Bookmark contain a URL.");
						}

						/** @type {WebPageIdCommData} */
						const webPageIdMessage = {
							functionName: "getWebPageId",
							properties: {
								url: currentBookmark.url,
								title: currentBookmark.title,
								storage,
							},
						};
						comms.postMessage(webPageIdMessage);
						comms.onMessage.addListener(
							/** @type {string} */ (webPageIdResponse) => {
								console.log(webPageIdResponse);
								if (webPageIdResponse && webPageIdResponse !== "") {
									domainLevel = checkLevels(existingABUBookmarks, webPageIdResponse);
								}
							}
						);

						if (existingABUBookmarks[bookmarkIndex] && domain === domainLevel) {
							matchingBookmarkIndex = bookmarkIndex;
						}
					}

					//GO THROUGH THE FOR LOOP (otherwise won't work with multiple pages and if in a higher-level domain; need to check for that)

					if (existingABUBookmarks[0] && !isNaN(matchingBookmarkIndex)) {
						//If we've found out the bookmark claimed to exist does, set the button so that:
						mainButton.innerHTML = "Revert to normal bookmark";
						mainButton.style.backgroundColor = "#f00";
						mainButton.onclick = function () {
							unABU(domain, storage[domain]["ABUid"]);
							chrome.action.setIcon({ path: inactiveIcons });
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

		let bookmarks = Object.keys(storage);

		//Create buttons for removing ABUkmarks
		for (let i = 0; i < bookmarks.length; i++) {
			const bookmarkData = storage[bookmarks[i]];
			if (!bookmarkData) {
				throw new Error(`Bookmark data not found in storage: ${bookmarks[i]}`);
			}
			//Don't create a button for the webpage domain we're on
			//Don't create a button for the ABUVersion object, which checks the current version in use.
			if (bookmarks[i] === domain || bookmarks[i] === "ABUVersion") {
				continue;
			}

			//Look for the bookmarks as we go through the list, to make sure they still exist.
			chrome.bookmarks.search("ABUid=" + bookmarkData.ABUid, function (thisBookmark3) {
				//console.log(storage[bookmarks[i]]["ABUid"],"Bookmark is: ",thisBookmark3,thisBookmark3.length);

				//If a bookmark in the list doesn't exist
				if (thisBookmark3.length === 0) {
					let ABUid = bookmarkData.ABUid;

					//Remove the info
					chrome.storage.sync.remove(bookmarks[i]);

					//Remove the element, if it exists
					let buttonElement = document.querySelector(`button[data-id="${ABUid}"]`);
					if (buttonElement) buttonElement.remove();
				}
			});

			//Add the button if it exists
			anywhereButtons += `<button data-id='${bookmarkData.ABUid}' data-domain='${bookmarks[i]}'>&times; <img src='${bookmarkData.favIconUrl}'> ${bookmarks[i]}</button>`;
		}

		//If the user doesn't have any ABUkmarks, don't show the horizontal rule
		if (anywhereButtons == "") {
			document.getElementsByTagName("hr")[0].style.display = "none";
		}

		console.log("Any favicons not found will produce errors below (it's not really worth worrying about)");

		Get.elementByID("abu-anywhere").innerHTML = anywhereButtons;

		let buttons = Get.elementByID("abu-anywhere").children;
		let images = document.getElementsByTagName("img");

		//Add functions for each button
		for (let ii = 0; ii < buttons.length; ii++) {
			const element = buttons[ii];
			// Skip non-button elements
			if (!(element instanceof HTMLButtonElement)) {
				console.log("Skipping non-button element at index", ii);
				continue;
			}

			element.onclick = function () {
				unABU(element.dataset.domain, element.dataset.id);
			};

			//Hide any images that fail to load properly
			images[ii].onerror = function () {
				this.style = "display:none;";
			};
		}
	});
}

//Warning when overwriting lower-level ABUkmarks
function overwriteWarning(bookmark) {
	if (bookmark.title.indexOf(" (ABU)") !== -1 && warning.indexOf("overwrit") == -1) {
		warningClass = "overwrite";
		warning += "<strong>Don't accidentally overwrite ABUkmarks deeper in the website!</strong> If you do it, do it on purpose. Any bookmarks ending in (ABU) are ABUkmarks.<br>";
	}
}

function ABU(input, mustMakeNew) {
	inArray = 0;
	inArrayDomain = "";

	if (mainButton.dataset.multiple === "1") {
		inArray = document.getElementsByTagName("SELECT")[0].selectedIndex;

		//Get the bookmark to change with this:
		if (document.getElementsByTagName("SELECT")[0].options[document.getElementsByTagName("SELECT")[0].selectedIndex].className !== "") {
			inArrayDomain = document.getElementsByTagName("SELECT")[0].options[document.getElementsByTagName("SELECT")[0].selectedIndex].dataset.domain;
		}
	}

	chrome.bookmarks.search(input, function (thisBookmark) {
		if (!thisBookmark[inArray] || mustMakeNew) {
			//If the bookmark doesn't exist

			//Check for ABUkmarks folder, add if doesn't exist
			chrome.bookmarks.search("ABUkmarks", function (thisFolder) {
				if (!thisFolder[0]) {
					//If folder ABUkmarks doesn't exist
					chrome.bookmarks.create({ title: "ABUkmarks" }, function (newFolder) {
						createABUkmark(input, newFolder.id);
					});
				} else {
					//If the folder exists
					createABUkmark(input, thisFolder[0].id);
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

			/** @type {BookmarkCommData} */
			const message = {
				functionName: "saveBookmarkData",
				properties: {
					bookmarkKey: input,
					bookmarkId: ABUid,
					favIconUrl,
				},
			};
			comms.postMessage(message);
			comms.onMessage.addListener((/** @type {boolean} */ returnMessage) => {
				if (returnMessage) {
					createPage();
				}
			});

			chrome.bookmarks.update(thisBookmark[inArray].id, { title: title + " (ABU)", url: createABURL(url, ABUid) });

			setNotification("");
		}
	});

	chrome.action.setIcon({ path: activeIcons });
}

//Create a new bookmark to be an ABUkmark
function createABUkmark(input, parentId) {
	const ABUid = Date.now();
	chrome.bookmarks.create({ parentId, title: title + " (ABU)", url: createABURL(url, ABUid) }, function (newBookmark) {
		/** @type {BookmarkCommData} */
		const message = {
			functionName: "saveBookmarkData",
			properties: {
				bookmarkKey: input,
				bookmarkId: ABUid,
				favIconUrl,
			},
		};
		comms.postMessage(message);
		comms.onMessage.addListener((/** @type {boolean} */ returnMessage) => {
			if (returnMessage) {
				createPage();
			}
		});
	});
}

//Make an ABURL
function createABURL(inputURL, inputABUid) {
	//ABURL is the URL that ABU creates that specifies the bookmark is ABU; it just appends a querystring with the id
	return inputURL + (inputURL.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + inputABUid;
}

function setNotification(input) {
	document.getElementById("notification").innerHTML = input;

	if (document.getElementById("onlyNewABU")) {
		document.getElementById("onlyNewABU").onclick = function () {
			ABU(domain, true);
		};
	}

	document.getElementById("notification").style.display = input !== "" ? "block" : "none";
}

//Make an ABUkmark back into a regular bookmark
function unABU(setUrl, setId) {
	//Get the bookmark
	chrome.bookmarks.search("ABUid=" + setId, function (targetABUkmark) {
		//Remove the ABU tag
		chrome.bookmarks.update(targetABUkmark[0].id, {
			url: targetABUkmark[0].url.replace(/(\?|&)ABUid=[0-9]+/g, ""),
			title: targetABUkmark[0].title.replace(" (ABU)", ""),
		});
	});
	chrome.storage.sync.remove(setUrl, function () {
		setNotification("");
		createPage();
	});
}

//Run a popup's element is present, run the popup script!
if (document.getElementById("current-page")) {
	console.log("ABU popup loaded!");

	//Have notifications depending on what's done
	mainButton.dataset.multiple = "0";

	//Get URL
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		//console.log(tabs);
		//Need to get storage here, for getting the webpage
		chrome.storage.sync.get(function (storage) {
			url = tabs[0].url;
			/** @type {WebPageIdCommData} */
			const message = {
				functionName: "getWebPageId",
				properties: {
					url,
					title: tabs[0].title,
					storage,
				},
			};
			comms.postMessage(message);
			comms.onMessage.addListener((/** @type {string} */ returnMessage) => {
				console.log("Return message current page:", returnMessage);
				if (returnMessage && returnMessage !== "") {
					domain = returnMessage;
				}
			});
			title = tabs[0].title;
			favIconUrl = tabs[0].favIconUrl;

			//Link to email me
			document.getElementById("email").onclick = function () {
				chrome.tabs.create({ active: true, url: "mailto:joshuapowlison@gmail.com", index: tabs[0].index + 1 });
			};

			//Link to my website
			document.getElementById("website").onclick = function () {
				chrome.tabs.create({ active: true, url: "https://joshpowlison.com/", index: tabs[0].index + 1 });
			};

			createPage();
		});
	});
}

/**
 * Creates utility functions for retrieving DOM elements by ID, tag, or class.
 */
function createGetUtilities() {
	return {
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
			const items = document.getElementsByClassName(className);
			const checked_items = [];
			for (const item of items) {
				if (item === null) {
					console.log("element:", item);
					throw new Error("Element is null in elementByClass.");
				}
				checked_items.push(item);
			}
			return checked_items;
		},
	};
}
