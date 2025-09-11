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

let mainButton: HTMLButtonElement;

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

	/////////ODD-URL WEBSITES COMPATABILITY/////////
	var oddUrl = null;

	//WEBTOONS// webtoons.com/language/genre/name/
	if (!oddUrl) oddUrl = /webtoons.com\/[^/]+\/[^/]+\/[^/]+\//.exec(url);

	//LEZHIM// lezhin.com/language/comic/title
	if (!oddUrl) oddUrl = /lezhin.com\/[^/]+\/comic\/[^/]+\//.exec(url);

	//MANGAHUB.IO// mangahub.com/chapter/title
	if (!oddUrl) oddUrl = /mangahub.io\/chapter\/[^/]+\//.exec(url);

	if (oddUrl) output = oddUrl[0];

	/////////SPECIAL WEBSITE COMPATABILITY/////////
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

function checkLevels(storge: ABUStorage, inputURL: string) {
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
		if (storge[test]) {
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

function createPage() {
	chrome.storage.sync.get(function (storage: ABUStorage) {
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
				ABUState.domain.substring(0, ABUState.domain.length - 2).indexOf("/") == -1 &&
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
			chrome.bookmarks.search(ABUState.domain, function (thisBookmark1) {
				if (thisBookmark1[0]) {
					//If the bookmark exists
					mainButton.innerHTML = "Convert to ABUkmark";
					mainButton.style.backgroundColor = "#9ccc5e";

					overwriteWarning(thisBookmark1[0]);

					setNotification(
						ABUState.warning +
							"Will convert <em title='" +
							thisBookmark1[0].url +
							"'>" +
							thisBookmark1[0].title +
							"</em>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>"
					);
					if (thisBookmark1.length > 1) {
						let bookmarksChoose = "";

						ABUState.warningClass = "";

						//Create a dropdown so you can choose which to change
						for (const bookmark of thisBookmark1) {
							if (!bookmark.url) continue;
							ABUState.warningClass = "";
							let thisBookmarkTitle;

							overwriteWarning(bookmark);

							const dropdownDomain = checkLevels(
								storage,
								getWebpage(bookmark.url, bookmark.title, storage)
							); //checkLevels(bookmark.url);

							//console.log(dropdownDomain);

							//Add a dropdown with the bookmarks info
							if (bookmark.title.indexOf(" (ABU)") == -1) {
								//If the bookmark is untitled, let the user know
								thisBookmarkTitle = bookmark.title;
								if (thisBookmarkTitle == "") {
									thisBookmarkTitle = "(Untitled)";
								}

								bookmarksChoose +=
									"<option class='" +
									ABUState.warningClass +
									"' title='" +
									bookmark.url +
									"' data-domain='" +
									dropdownDomain +
									"' value='" +
									bookmark.id +
									"'>" +
									thisBookmarkTitle +
									"</option>";
							} else {
								bookmarksChoose +=
									"<option class='overwrite' title='" +
									bookmark.url +
									"' data-domain='" +
									dropdownDomain +
									"' value='" +
									bookmark.id +
									"'>" +
									bookmark.title +
									"</option>";
							}
						}
						setNotification(
							ABUState.warning +
								thisBookmark1.length +
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
					ABU(ABUState.domain, false);
				};
			});
		} else {
			//If we have an ABUkmark for this, according to our data
			chrome.bookmarks.search(
				"ABUid=" + storage[ABUState.domain]["ABUid"],
				function (thisBookmark2) {
					if (!thisBookmark2) {
						chrome.storage.sync.remove(ABUState.domain);
					} else {
						let check = false;
						for (const bookmark of thisBookmark2) {
							if (!bookmark.url) continue;
							const checkedDomain = checkLevels(
								storage,
								getWebpage(bookmark.url, bookmark.title, storage)
							);
							if (ABUState.domain === checkedDomain) {
								check = true;
							}
						}

						//GO THROUGH THE FOR LOOP (otherwise won't work with multiple pages and if in a higher-level domain; need to check for that)

						if (thisBookmark2[0] && check === true) {
							//If we've found out the bookmark claimed to exist does, set the button so that:
							mainButton.innerHTML = "Revert to normal bookmark";
							mainButton.style.backgroundColor = "#f00";
							mainButton.onclick = function () {
								unABU(ABUState.domain, storage[ABUState.domain]["ABUid"]);
								chrome.browserAction.setIcon({ path: inactiveIcons });
							};
						} else {
							chrome.storage.sync.remove(ABUState.domain);
							mainButton.innerHTML = "Create ABUkmark";
							mainButton.style.backgroundColor = "#619919";
							mainButton.onclick = function () {
								ABU(ABUState.domain, false);
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
						const ABUid = storage[bookmarks[i]].ABUid;

						//Remove the info
						chrome.storage.sync.remove(bookmarks[i]);

						const ABUButton = document.querySelector(`button[data-id="${ABUid}"]`);
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

		const abuAnywhere = document.getElementById("abu-anywhere");
		if (!abuAnywhere) return;

		abuAnywhere.innerHTML = anywhereButtons;

		const buttons = abuAnywhere.getElementsByTagName("button");
		const images = abuAnywhere.getElementsByTagName("img");

		//Add functions for each button
		for (let ii = 0; ii < buttons.length; ii++) {
			const button = buttons[ii];
			if (!button.dataset.domain || !button.dataset.id) continue;
			button.onclick = function () {
				unABU(button.dataset.domain, button.dataset.id);
			};

			//Hide any images that fail to load properly
			const image = images[ii];
			image.onerror = function () {
				image.style.display = "none";
			};
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

function ABU(inputUrl: string, mustMakeNew: boolean) {
	let inArray = 0;
	let inArrayDomain = "";

	if (mainButton.dataset.multiple === "1") {
		const selectElement = document.getElementsByTagName("SELECT")[0] as HTMLSelectElement;
		inArray = selectElement.selectedIndex;

		//Get the bookmark to change with this:
		if (selectElement.options[selectElement.selectedIndex].className !== "") {
			const selectDomain =
				selectElement.options[selectElement.selectedIndex].dataset.domain;
			if (selectDomain) inArrayDomain = selectDomain;
		}
	}

	chrome.bookmarks.search(inputUrl, function (thisBookmark) {
		if (!thisBookmark[inArray] || mustMakeNew) {
			//If the bookmark doesn't exist

			//Check for ABUkmarks folder, add if doesn't exist
			chrome.bookmarks.search("ABUkmarks", function (thisFolder) {
				if (!thisFolder[0]) {
					//If folder ABUkmarks doesn't exist
					chrome.bookmarks.create({ title: "ABUkmarks" }, function (newFolder) {
						createABUkmark(inputUrl, newFolder.id);
					});
				} else {
					//If the folder exists
					createABUkmark(inputUrl, thisFolder[0].id);
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

			storeObj(inputUrl, ABUid);

			chrome.bookmarks.update(thisBookmark[inArray].id, {
				title: ABUState.title + " (ABU)",
				url: createABURL(ABUState.url, ABUid)
			});

			setNotification("");
		}
	});

	chrome.browserAction.setIcon({ path: activeIcons });
}

//Create a new bookmark to be an ABUkmark
function createABUkmark(inputUrl: string, parentId: string) {
	const ABUid = Date.now();
	chrome.bookmarks.create(
		{
			parentId: parentId,
			title: ABUState.title + " (ABU)",
			url: createABURL(ABUState.url, ABUid)
		},
		function () {
			storeObj(inputUrl, ABUid);
		}
	);
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
			ABU(ABUState.domain, true, false);
		};
	}

	document.getElementById("notification").style.display = input !== "" ? "block" : "none";
}

//Stores an object in the user's synced data
function storeObj(input, bookmarkId) {
	var obj = {};
	var foo = input;
	obj[foo] = { ABUid: bookmarkId, favIconUrl: ABUState.favIconUrl };
	chrome.storage.sync.set(obj);
	createPage();
}

//Make an ABUkmark back into a regular bookmark
function unABU(setUrl, setId) {
	//Get the bookmark
	chrome.bookmarks.search("ABUid=" + setId, function (targetABUkmark) {
		//Remove the ABU tag
		chrome.bookmarks.update(targetABUkmark[0].id, {
			url: targetABUkmark[0].url.replace(/(\?|&)ABUid=[0-9]+/g, ""),
			title: targetABUkmark[0].title.replace(" (ABU)", "")
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

	mainButton = document.getElementById("current-page");
	mainButton.dataset.multiple = 0;

	//Get URL
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		//console.log(tabs);
		//Need to get storage here, for getting the webpage
		chrome.storage.sync.get(function (storage) {
			ABUState.url = tabs[0].url;
			ABUState.domain = getWebpage(ABUState.url, tabs[0].title, storage);
			ABUState.title = tabs[0].title;
			ABUState.favIconUrl = tabs[0].favIconUrl;

			//Link to email me
			document.getElementById("email").onclick = function () {
				chrome.tabs.create({
					active: true,
					url: "mailto:joshuapowlison@gmail.com",
					index: tabs[0].index + 1
				});
			};

			//Link to my website
			document.getElementById("website").onclick = function () {
				chrome.tabs.create({
					active: true,
					url: "https://joshpowlison.com/",
					index: tabs[0].index + 1
				});
			};

			createPage();
		});
	});
}
