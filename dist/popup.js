import { activeIcons, inactiveIcons, ABUState, getWebpage, checkLevels, createABURL } from "./common.js";
let mainButton;
console.log("ABU popup loaded!");
const mainButtonCheck = document.getElementById("current-page");
if (!mainButtonCheck) {
    throw new Error("mainButtonCheck is null");
}
mainButton = mainButtonCheck;
mainButton.dataset.multiple = "0";
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab.url || !tab.title || !tab.favIconUrl) {
        return;
    }
    const url = tab.url;
    const title = tab.title;
    const favIconUrl = tab.favIconUrl;
    chrome.storage.sync.get(function (storage) {
        ABUState.url = url;
        ABUState.domain = getWebpage(ABUState.url, title, storage);
        ABUState.title = title;
        ABUState.favIconUrl = favIconUrl;
        createPage();
    });
});
function createPage() {
    chrome.storage.sync.get(function (storage) {
        const version = chrome.runtime.getManifest().version;
        if (!storage.ABUVersion || storage.ABUVersion < Number(version)) {
            document
                .getElementsByTagName("BODY")[0]
                .insertAdjacentHTML("afterbegin", "<p id='update'>ABU 1.5 is now a manifest v3 extension. Always feel free to let me know if ABU doesn't work on any website!</p>");
            chrome.storage.sync.set({ ABUVersion: Number(version) });
        }
        mainButton.dataset.multiple = "0";
        console.log("url is", ABUState.url);
        if ((ABUState.domain.indexOf("/") !== -1 &&
            ABUState.domain.substring(0, ABUState.domain.length - 2).indexOf("/") == -1 &&
            !/(page|p|date)=/i.test(ABUState.url) &&
            !/tapas.io\/(series|episode)\//.test(ABUState.url)) ||
            /mangahub.io\/manga\//.test(ABUState.url)) {
            if (ABUState.warning.indexOf("a subpage if") === -1)
                ABUState.warning +=
                    "ABUkmark a subpage if possible so visiting about, archives, links, etc doesn't update bookmarks. Just click on an article, a back button, or a button to start reading and it should be perfect!<br>";
        }
        let anywhereButtons = "";
        ABUState.domain = checkLevels(storage, ABUState.domain);
        if (!storage[ABUState.domain]) {
            chrome.bookmarks.search(ABUState.domain, function (thisBookmark1) {
                if (thisBookmark1[0]) {
                    mainButton.innerHTML = "Convert to ABUkmark";
                    mainButton.style.backgroundColor = "#9ccc5e";
                    overwriteWarning(thisBookmark1[0]);
                    setNotification(ABUState.warning +
                        "Will convert <em title='" +
                        thisBookmark1[0].url +
                        "'>" +
                        thisBookmark1[0].title +
                        "</em>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>");
                    if (thisBookmark1.length > 1) {
                        let bookmarksChoose = "";
                        ABUState.warningClass = "";
                        for (const bookmark of thisBookmark1) {
                            if (!bookmark.url)
                                continue;
                            ABUState.warningClass = "";
                            let thisBookmarkTitle;
                            overwriteWarning(bookmark);
                            const dropdownDomain = checkLevels(storage, getWebpage(bookmark.url, bookmark.title, storage));
                            if (bookmark.title.indexOf(" (ABU)") == -1) {
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
                            }
                            else {
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
                        setNotification(ABUState.warning +
                            thisBookmark1.length +
                            " bookmarks spotted. Will convert <select>" +
                            bookmarksChoose +
                            "</select>. <span id='onlyNewABU'>Or, make a new ABUkmark.</span>");
                        mainButton.dataset.multiple = "1";
                    }
                }
                else {
                    mainButton.innerHTML = "Create ABUkmark";
                    mainButton.style.backgroundColor = "#619919";
                    if (ABUState.warning !== "") {
                        setNotification(ABUState.warning);
                    }
                }
                mainButton.onclick = function () {
                    ABU(ABUState.domain, false);
                };
            });
        }
        else {
            chrome.bookmarks.search("ABUid=" + storage[ABUState.domain]["ABUid"], function (thisBookmark2) {
                if (!thisBookmark2) {
                    chrome.storage.sync.remove(ABUState.domain);
                }
                else {
                    let check = false;
                    for (const bookmark of thisBookmark2) {
                        if (!bookmark.url)
                            continue;
                        const checkedDomain = checkLevels(storage, getWebpage(bookmark.url, bookmark.title, storage));
                        if (ABUState.domain === checkedDomain) {
                            check = true;
                        }
                    }
                    if (thisBookmark2[0] && check === true) {
                        mainButton.innerHTML = "Revert to normal bookmark";
                        mainButton.style.backgroundColor = "#f00";
                        mainButton.onclick = function () {
                            unABU(ABUState.domain, storage[ABUState.domain]["ABUid"]);
                            chrome.action.setIcon({ path: inactiveIcons });
                        };
                    }
                    else {
                        chrome.storage.sync.remove(ABUState.domain);
                        mainButton.innerHTML = "Create ABUkmark";
                        mainButton.style.backgroundColor = "#619919";
                        mainButton.onclick = function () {
                            ABU(ABUState.domain, false);
                        };
                    }
                }
            });
        }
        var bookmarks = Object.keys(storage);
        for (let i = 0; i < bookmarks.length; i++) {
            if (bookmarks[i] == ABUState.domain || bookmarks[i] == "ABUVersion") {
                continue;
            }
            chrome.bookmarks.search("ABUid=" + storage[bookmarks[i]]["ABUid"], function (thisBookmark3) {
                if (thisBookmark3.length === 0) {
                    const ABUid = storage[bookmarks[i]].ABUid;
                    chrome.storage.sync.remove(bookmarks[i]);
                    const ABUButton = document.querySelector(`button[data-id="${ABUid}"]`);
                    if (ABUButton)
                        ABUButton.remove();
                }
            });
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
        if (anywhereButtons == "") {
            document.getElementsByTagName("hr")[0].style.display = "none";
        }
        console.log("Any favicons not found will produce errors below (it's not really worth worrying about)");
        const abuAnywhere = document.getElementById("abu-anywhere");
        if (!abuAnywhere)
            return;
        abuAnywhere.innerHTML = anywhereButtons;
        const buttons = abuAnywhere.getElementsByTagName("button");
        const images = abuAnywhere.getElementsByTagName("img");
        for (let ii = 0; ii < buttons.length; ii++) {
            const button = buttons[ii];
            button.onclick = function () {
                if (!button.dataset.domain || !button.dataset.id)
                    return;
                unABU(button.dataset.domain, Number(button.dataset.id));
            };
            const image = images[ii];
            image.onerror = function () {
                image.style.display = "none";
            };
        }
    });
}
function overwriteWarning(bookmark) {
    if (bookmark.title.indexOf(" (ABU)") !== -1 &&
        ABUState.warning.indexOf("overwrit") == -1) {
        ABUState.warningClass = "overwrite";
        ABUState.warning +=
            "<strong>Don't accidentally overwrite ABUkmarks deeper in the website!</strong> If you do it, do it on purpose. Any bookmarks ending in (ABU) are ABUkmarks.<br>";
    }
}
function ABU(inputUrl, mustMakeNew) {
    let inArray = 0;
    let inArrayDomain = "";
    if (mainButton.dataset.multiple === "1") {
        const selectElement = document.getElementsByTagName("SELECT")[0];
        inArray = selectElement.selectedIndex;
        if (selectElement.options[selectElement.selectedIndex].className !== "") {
            const selectDomain = selectElement.options[selectElement.selectedIndex].dataset.domain;
            if (selectDomain)
                inArrayDomain = selectDomain;
        }
    }
    chrome.bookmarks.search(inputUrl, function (thisBookmark) {
        if (!thisBookmark[inArray] || mustMakeNew) {
            chrome.bookmarks.search("ABUkmarks", function (thisFolder) {
                if (!thisFolder[0]) {
                    chrome.bookmarks.create({ title: "ABUkmarks" }, function (newFolder) {
                        createABUkmark(inputUrl, newFolder.id);
                    });
                }
                else {
                    createABUkmark(inputUrl, thisFolder[0].id);
                }
                setNotification("New ABUkmark located in <em>Other bookmarks &#8594; ABUkmarks</em>");
            });
        }
        else {
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
    chrome.action.setIcon({ path: activeIcons });
}
function createABUkmark(inputUrl, parentId) {
    const ABUid = Date.now();
    chrome.bookmarks.create({
        parentId: parentId,
        title: ABUState.title + " (ABU)",
        url: createABURL(ABUState.url, ABUid)
    }, function () {
        storeObj(inputUrl, ABUid);
    });
}
function setNotification(htmlString) {
    const notificationElement = document.getElementById("notification");
    if (!notificationElement)
        return;
    notificationElement.innerHTML = htmlString;
    const onlyNewABUElement = document.getElementById("onlyNewABU");
    if (!onlyNewABUElement)
        return;
    onlyNewABUElement.onclick = function () {
        ABU(ABUState.domain, true);
    };
    notificationElement.style.display = htmlString !== "" ? "block" : "none";
}
function storeObj(scopeKey, ABUid) {
    var newStorage = {
        [scopeKey]: { ABUid, favIconUrl: ABUState.favIconUrl }
    };
    chrome.storage.sync.set(newStorage);
    createPage();
}
function unABU(scopeKey, ABUid) {
    chrome.bookmarks.search(`ABUid=${ABUid}`, function (targetABUkmark) {
        const ABUBookmark = targetABUkmark[0];
        if (!ABUBookmark.url)
            return;
        chrome.bookmarks.update(ABUBookmark.id, {
            url: ABUBookmark.url.replace(/(\?|&)ABUid=[0-9]+/g, ""),
            title: ABUBookmark.title.replace(" (ABU)", "")
        });
    });
    chrome.storage.sync.remove(scopeKey, function () {
        setNotification("");
        createPage();
    });
}
