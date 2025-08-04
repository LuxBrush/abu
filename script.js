import { createABURL, Get, resolveUrlPath, normalizeContentUrl } from "./tools.js";
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

	chrome.action.setIcon({ path: activeIcons });
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
