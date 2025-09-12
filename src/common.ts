//Icons
const activeIcons = { "128": "icons/128blue.png" };
const inactiveIcons = { "128": "icons/128gray.png" };

const ABUState = {
	url: "",
	domain: "",
	title: "",
	favIconUrl: "",
	warning: "", // Warn about home page ABUkmarks going everywhere if they're on the home page
	warningClass: ""
};

/**
 * Determines the most relevant webpage level for creating or finding an ABUkmark.
 * This function analyzes the URL and title to handle special cases for various websites.
 * @param url The URL of the current tab.
 * @param title The title of the current tab.
 * @param storage The current ABUStorage object.
 * @returns A string representing the determined webpage scope (a URL snippet or special key).
 */
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

	/////////ODD-URL WEBSITES COMPATIBILITY/////////
	var oddUrl = null;

	//WEBTOONS// webtoons.com/language/genre/name/
	if (!oddUrl) oddUrl = /webtoons.com\/[^/]+\/[^/]+\/[^/]+\//.exec(url);

	//LEZHIM// lezhin.com/language/comic/title
	if (!oddUrl) oddUrl = /lezhin.com\/[^/]+\/comic\/[^/]+\//.exec(url);

	//MANGAHUB.IO// mangahub.com/chapter/title
	if (!oddUrl) oddUrl = /mangahub.io\/chapter\/[^/]+\//.exec(url);

	if (oddUrl) output = oddUrl[0];

	/////////SPECIAL WEBSITE COMPATIBILITY/////////
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

/**
 * Traverses up the URL path to find the highest-level existing ABUkmark for a given URL.
 * @param storage The ABUStorage object.
 * @param inputURL The URL to check.
 * @returns The URL of the highest-level ABUkmark found, or the original URL if none is found.
 */
function checkLevels(storage: ABUStorage, inputURL: string) {
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
		if (storage[test]) {
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

/**
 * Appends an ABUid to a URL as a query parameter.
 * @param inputURL The URL to modify.
 * @param inputABUid The ABUid to append.
 * @returns The new URL with the ABUid.
 */
function createABURL(inputURL: string, inputABUid: number) {
	//ABURL is the URL that ABU creates that specifies the bookmark is ABU; it just appends a querystring with the id
	return inputURL + (inputURL.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + inputABUid;
}

/**
 * Injects a script into the page to track video progress and update the URL with the current timestamp.
 * This is primarily for video websites like YouTube.
 */
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
	function setTabURLTime(time: number) {
		const url = new URL(location.href);
		const newTime = `${Math.floor(time)}s`;

		if (url.searchParams.get("t") === newTime) return;
		url.searchParams.set("t", newTime);
		history.replaceState(history.state, "", url);
	}
}

export {
	activeIcons,
	inactiveIcons,
	ABUState,
	getWebpage,
	checkLevels,
	createABURL,
	getProgress
};
