import { createABURL, Get, resolveUrlPath, normalizeContentUrl, setNotification, activeIcons, inactiveIcons } from "./tools.js";
const ABUVersion = chrome.runtime.getManifest().version;

//Call the variables here
let url = "";
let domain = "";
let title = "";
let favIconUrl = "";

// Note: warning and warningClass are now localized within createPage()

function createPage() {
	chrome.storage.sync.get(function (/** @type {StorageObject} */ storage) {
		// Local UI state
		let warning = "";
		let warningClass = "";
		// ABUVersion info (compare by equality to avoid numeric/string issues)
		if (storage.ABUVersion !== ABUVersion) {
			const updateElement = document.createElement("p");
			updateElement.id = "update";
			updateElement.textContent = `ABU updated to v${ABUVersion}. If anything breaks, please let me know!`;
			document.getElementsByTagName("BODY")[0].prepend(updateElement);
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

		const anywhereButtonsFragment = document.createDocumentFragment();

		domain = resolveUrlPath(storage, domain);

		//Setup buttons
		if (!storage[domain]) {
			//If we don't have an ABUkmark for this site
			chrome.bookmarks.search(domain, function (thisBookmark1) {
				if (thisBookmark1[0]) {
					const firstBookmark = thisBookmark1[0];
					if (!firstBookmark.url) {
						console.error("Bookmark URL is undefined or null");
						return;
					}
					//If the bookmark exists
					mainButton.textContent = "Convert to ABUkmark";
					if (mainButton.classList.contains("revert-bookmark")) {
						mainButton.classList.remove("revert-bookmark");
					}
					mainButton.classList.add("convert-abukmark");

					({ warning, warningClass } = overwriteWarning(firstBookmark, warning));

					const notificationContent = document.createDocumentFragment();

					if (warning) {
						const warningSpan = document.createElement("span");
						warningSpan.innerHTML = warning; // Using innerHTML here as warning may contain HTML
						notificationContent.appendChild(warningSpan);
					}

					const willConvertText = document.createTextNode("Will convert ");
					notificationContent.appendChild(willConvertText);

					const bookmarkEm = document.createElement("em");
					bookmarkEm.title = firstBookmark.url;
					bookmarkEm.textContent = firstBookmark.title;
					notificationContent.appendChild(bookmarkEm);

					const periodText = document.createTextNode(". ");
					notificationContent.appendChild(periodText);

					const newAbuSpan = document.createElement("span");
					newAbuSpan.id = "onlyNewABU";
					newAbuSpan.textContent = "Or, make a new ABUkmark.";
					notificationContent.appendChild(newAbuSpan);

					setNotification(notificationContent, ABU, domain);
					if (thisBookmark1.length > 1) {
						const bookmarksChoose = document.createDocumentFragment();

						warningClass = "";

						//Create a dropdown so you can choose which to change
						for (let i = 0; i < thisBookmark1.length; i++) {
							const currentBookmark = thisBookmark1[i];
							if (!currentBookmark.url) {
								console.error("Current Bookmark URL is undefined or null");
								continue;
							}
							warningClass = "";

							({ warning, warningClass } = overwriteWarning(thisBookmark1[i], warning));

							const dropdownDomain = resolveUrlPath(storage, normalizeContentUrl(currentBookmark.url, currentBookmark.title, storage)); //checkLevels(thisBookmark1[i].url);

							//console.log(dropdownDomain);

							//Add a dropdown with the bookmarks info
							if (currentBookmark.title.indexOf(" (ABU)") === -1) {
								//If the bookmark is untitled, let the user know
								let thisBookmarkTitle = currentBookmark.title;
								if (thisBookmarkTitle == "") {
									thisBookmarkTitle = "(Untitled)";
								}

								const option = document.createElement("option");
								if (warningClass) {
									option.className = warningClass;
								}
								option.title = currentBookmark.url;
								option.dataset.domain = dropdownDomain;
								option.value = currentBookmark.id;
								option.textContent = thisBookmarkTitle;
								bookmarksChoose.appendChild(option);
							} else {
								const option = document.createElement("option");
								option.className = "overwrite";
								option.title = currentBookmark.url;
								option.dataset.domain = dropdownDomain;
								option.value = currentBookmark.id;
								option.textContent = currentBookmark.title;
								bookmarksChoose.appendChild(option);
							}
						}
						const notificationContent = document.createDocumentFragment();

						if (warning) {
							const warningSpan = document.createElement("span");
							warningSpan.innerHTML = warning; // Using innerHTML here as warning may contain HTML
							notificationContent.appendChild(warningSpan);
						}

						const bookmarksText = document.createTextNode(thisBookmark1.length + " bookmarks spotted. Will convert ");
						notificationContent.appendChild(bookmarksText);

						const selectElement = document.createElement("select");
						selectElement.appendChild(bookmarksChoose);
						notificationContent.appendChild(selectElement);

						const periodText = document.createTextNode(". ");
						notificationContent.appendChild(periodText);

						const newAbuSpan = document.createElement("span");
						newAbuSpan.id = "onlyNewABU";
						newAbuSpan.textContent = "Or, make a new ABUkmark.";
						notificationContent.appendChild(newAbuSpan);

						setNotification(notificationContent, ABU, domain);
						mainButton.dataset.multiple = "1";
					}
				} else {
					//If it doesn't
					//Change the button's text and color
					mainButton.textContent = "Create ABUkmark";
					mainButton.classList.add("create-abukmark");
					//Set the notification if there's a warning
					if (warning !== "") {
						const warningElement = document.createElement("span");
						warningElement.innerHTML = warning; // Using innerHTML as warning may contain HTML
						setNotification(warningElement, ABU, domain);
					}
				}
				mainButton.onclick = function () {
					ABU(domain, false);
				};
			});
		} else {
			const domainData = storage[domain];
			if (!domainData) {
				console.error("No ABUkmark found for this domain in storage");
				return;
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
						mainButton.textContent = "Revert to normal bookmark";
						mainButton.className = ""; // Clear any existing classes
						mainButton.classList.add("revert-bookmark");
						mainButton.onclick = function () {
							const domainData = storage[domain];
							if (!domainData) {
								console.error("Domain data not found in storage for unABU operation");
								return;
							}
							unABU(domain, domainData.ABUid);
							chrome.action.setIcon({ path: inactiveIcons });
						};
					} else {
						chrome.storage.sync.remove(domain);
						mainButton.textContent = "Create ABUkmark";
						mainButton.className = ""; // Clear any existing classes
						mainButton.classList.add("create-abukmark");
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
				console.error(`Storage data not found for key: ${key}`);
				continue;
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
			const button = document.createElement("button");
			button.dataset.id = String(abuBookmark.ABUid);
			button.dataset.domain = key;

			const closeText = document.createTextNode("× ");
			button.appendChild(closeText);

			const img = document.createElement("img");
			img.src = abuBookmark.favIconUrl;
			button.appendChild(img);

			const domainText = document.createTextNode(" " + key);
			button.appendChild(domainText);

			anywhereButtonsFragment.appendChild(button);
		}

		// If the user doesn't have any ABUkmarks, don't show the horizontal rule
		if (anywhereButtonsFragment.childNodes.length === 0) {
			document.getElementsByTagName("hr")[0].classList.add("hidden");
		}

		console.log("Any favicons not found will produce errors below (it's not really worth worrying about)");

		const anywhereDiv = document.getElementById("abu-anywhere");
		if (!anywhereDiv) {
			console.error("Element with ID 'abu-anywhere' not found");
			return;
		}

		anywhereDiv.innerHTML = ""; // Clear existing content
		anywhereDiv.appendChild(anywhereButtonsFragment);

		let anywhereButtons = /** @type {HTMLCollectionOf<HTMLButtonElement>} */ (anywhereDiv.children);

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

			// Hide any images that fail to load properly
			const image = anywhereButton.querySelector("img");
			if (image) {
				image.onerror = () => {
					image.classList.add("hidden");
				};
			}
		}
	});
}

/**
 * Checks if a bookmark is an ABUkmark and returns updated warning state.
 *
 * Called when displaying bookmarks in the popup interface. If a bookmark is
 * already an ABUkmark (title contains "(ABU)"), we append a warning message
 * and set warningClass to "overwrite" for styling.
 *
 * @param {chrome.bookmarks.BookmarkTreeNode} bookmark - The bookmark to check.
 * @param {string} warning - The current warning HTML string.
 * @returns {{ warning: string, warningClass: string }} Updated values.
 */
function overwriteWarning(bookmark, warning) {
	let warningClass = "";
	if (bookmark.title.indexOf(" (ABU)") !== -1 && warning.indexOf("overwrite") === -1) {
		warningClass = "overwrite";

		// Create warning message elements
		const strongElement = document.createElement("strong");
		strongElement.textContent = "Don't accidentally overwrite ABUkmarks deeper in the website!";

		const warningText = " If you do it, do it on purpose. Any bookmarks ending in (ABU) are ABUkmarks.";

		// Build safe HTML string for later innerHTML usage
		warning += strongElement.outerHTML + warningText + "<br>";
	}
	return { warning, warningClass };
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
				setNotification("New ABUkmark located in <em>Other bookmarks &#8594; ABUkmarks</em>", ABU, domain);
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

			createPage();
		});
	});
}
