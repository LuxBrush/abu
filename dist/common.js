const activeIcons = { "128": "icons/128blue.png" };
const inactiveIcons = { "128": "icons/128gray.png" };
const ABUState = {
    url: "",
    domain: "",
    title: "",
    favIconUrl: "",
    warning: "",
    warningClass: ""
};
function getWebpage(url, title, storage) {
    let output = "";
    const match = /(\S+\/\/+[^\/]+[^\d\?]+\/)+(?!$)/.exec(url);
    if (match)
        output = match[0];
    output = output.replace(/[^\/]+\/\/(www.)?/, "");
    const keywordCheck = /.+\/(blog|comic)\//.exec(output);
    if (keywordCheck)
        output = keywordCheck[0];
    var indicativeCheck = /.+\/(?=season-|ep-|episode-|page-|p-)/.exec(output);
    if (indicativeCheck)
        output = indicativeCheck[0];
    var oddUrl = null;
    if (!oddUrl)
        oddUrl = /webtoons.com\/[^/]+\/[^/]+\/[^/]+\//.exec(url);
    if (!oddUrl)
        oddUrl = /lezhin.com\/[^/]+\/comic\/[^/]+\//.exec(url);
    if (!oddUrl)
        oddUrl = /mangahub.io\/chapter\/[^/]+\//.exec(url);
    if (oddUrl)
        output = oddUrl[0];
    let special = null;
    if (/tapas.io\/(series|episode)\//.test(url) && title) {
        special = /.+(?=\s::)/.exec(title) || /.+(?=\s\|)/.exec(title);
        if (special)
            special = special[0];
        output = "tapas.io/";
    }
    let ytUrl = null;
    if (/youtube.com\/.+list=/.test(url)) {
        ytUrl = /(?:\?|&)list=[^?&]*/.exec(url);
        if (ytUrl)
            special = ytUrl[0];
    }
    else if (/youtube.com\/watch\?v=[^?&]*/.test(url)) {
        ytUrl = /(?:\?|&)v=[^?&]*/.exec(url);
        if (ytUrl)
            special = ytUrl[0];
    }
    if (/docs.google.com\/presentation\/d\/.+\//.test(url)) {
        const gSheetUrl = /docs.google.com\/presentation\/d\/.+\//.exec(url);
        if (gSheetUrl)
            special = gSheetUrl[0];
    }
    if (special) {
        if (storage[special] || !storage[checkLevels(storage, output)]) {
            output = special;
        }
    }
    return output;
}
function checkLevels(storage, inputURL) {
    var test = inputURL, output = inputURL;
    if (inputURL.indexOf("/") === -1) {
        return inputURL;
    }
    for (let i = 0; i < 10; i++) {
        if (storage[test]) {
            output = test;
            break;
        }
        test = test.substring(0, test.length - 1).substring(0, test.lastIndexOf("/") + 1);
    }
    return output;
}
function createABURL(inputURL, inputABUid) {
    return inputURL + (inputURL.indexOf("?") > -1 ? "&" : "?") + "ABUid=" + inputABUid;
}
function getProgress() {
    const videoTest = document.querySelector("video");
    if (!videoTest)
        return;
    videoTest.addEventListener("timeupdate", () => {
        setTabURLTime(videoTest.currentTime);
    });
    function setTabURLTime(time) {
        const url = new URL(location.href);
        const newTime = `${Math.floor(time)}s`;
        if (url.searchParams.get("t") === newTime)
            return;
        url.searchParams.set("t", newTime);
        history.replaceState(history.state, "", url);
    }
}
export { activeIcons, inactiveIcons, ABUState, getWebpage, checkLevels, createABURL, getProgress };
