//Icons
const activeIcons = { 128: "icons/128blue.png" };
const inactiveIcons = { 128: "icons/128gray.png" };

const ABUVersion = 1.4;

const ABUState = {
	url: "",
	domain: "",
	title: "",
	favIconUrl: "",
	warning: "",
	warningClass: "",
};

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
		test = test
			.substring(0, test.length - 1)
			.substring(0, test.lastIndexOf("/") + 1);

		//If we run 10 times and don't find a new thing, we'll just use the original input
	}

	return output;
}

export { activeIcons, inactiveIcons, ABUVersion, ABUState, checkLevels };
