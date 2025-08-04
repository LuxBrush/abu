const { Get } = Check();
/**
 * Creates a URL with an ABU (Automatic Bookmark Updater) identifier appended as a query parameter.
 * The function automatically handles the appropriate URL parameter separator (? or &) based on the input URL.
 *
 * @param {string} url - The base URL to which the ABU identifier will be appended
 * @param {string|number} ABUid - The unique identifier to be added to the URL
 * @returns {string} The modified URL with the ABU identifier as a query parameter
 */
function createABURL(url, ABUid) {
	//ABURL is the URL that ABU creates that specifies the bookmark is ABU; it just appends a querystring with the id
	return url + (url.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + ABUid;
}

/**
 * Updates the notification element's content and visibility, and sets up the click handler
 * for creating a new ABUkmark when the notification is shown.
 *
 * @param {string} html - The HTML content to display in the notification.
 *                         If an empty string, the notification will be hidden.
 * @param {Function} ABU
 * @param {string} domain
 * @returns {void}
 */
function setNotification(html, ABU, domain) {
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

function Check() {
	return {
		Get: {
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
				const elements = Array.from(document.getElementsByClassName(className));
				const checked_items = [];
				for (const element of elements) {
					if (element === null) {
						console.log("element:", element);
						continue;
					}
					checked_items.push(element);
				}
				return checked_items;
			},
			/**
			 * Gets the bounding client rect of an element.
			 * @param {string} id - The element ID.
			 * @returns {DOMRect} The element's bounding client rect.
			 */
			boundingClientRect(id) {
				const element = this.elementByID(id);
				return element.getBoundingClientRect();
			},
		},
	};
}

export { createABURL, setNotification };
