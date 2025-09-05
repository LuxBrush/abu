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

	/////////SPECIAL WEBSITE COMPATIBILITY/////////
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

export {
	activeIcons,
	inactiveIcons,
	ABUVersion,
	ABUState,
	getProgress,
	checkLevels,
	getWebpage,
};
