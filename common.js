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

function getProgress() {
	const videoTest = document.querySelector("video");
	if (!videoTest) return;
	videoTest.addEventListener("timeupdate", () => {
		setTabURLTime(videoTest.currentTime);
	});

	/**
	 * Updates the current URL with the video's current timestamp
	 * Sets a 't' parameter in the URL query string with the current time in seconds
	 * Uses history.replaceState to update the URL without reloading the page
	 * @param {number} time - The current video playback time in seconds
	 */
	function setTabURLTime(time) {
		const url = new URL(location.href);
		const newTime = `${Math.floor(time)}s`;

		if (url.searchParams.get("t") === newTime) return;
		url.searchParams.set("t", newTime);
		history.replaceState(history.state, "", url);
	}
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
		test = test.substring(0, test.length - 1).substring(0, test.lastIndexOf("/") + 1);

		//If we run 10 times and don't find a new thing, we'll just use the original input
	}

	return output;
}

export { activeIcons, inactiveIcons, ABUVersion, ABUState, getProgress, checkLevels };
