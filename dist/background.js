import { activeIcons, inactiveIcons, ABUState, getWebpage, checkLevels, createABURL, getProgress } from "./common.js";
console.log("May get an error: Unchecked runtime.lastError: The tab was closed. The code should keep running, but there's no way to check for if a tab exists; only to hide the error. I opted for just letting it be. :P");
chrome.tabs.onUpdated.addListener(async function (_tabId, changeInfo, updatedTab) {
    if (!updatedTab.url) {
        console.error("Tab update received with no URL - cannot process");
        return;
    }
    if (changeInfo.status === "loading") {
        const newURL = updatedTab.url.replace(/(\?|\&)ABUid.*/, "");
        if (newURL !== updatedTab.url) {
            if (updatedTab.id) {
                await chrome.tabs.update(updatedTab.id, { url: newURL });
            }
        }
    }
    if ((changeInfo.status === "complete" || changeInfo.title) && !/[?&]ABUid=/.test(updatedTab.url)) {
        await updateTabInfo(updatedTab);
    }
});
chrome.tabs.onActivated.addListener(function (activatedTab) {
    chrome.tabs.get(activatedTab.tabId, async function (getTab) {
        await updateTabInfo(getTab);
    });
});
async function updateTabInfo(thisTab) {
    if (!thisTab.url || !thisTab.title || !thisTab.id)
        return;
    const tabUrl = thisTab.url;
    const tabTitle = thisTab.title;
    const tabId = thisTab.id;
    if (/youtube.com\/watch/.test(tabUrl)) {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: getProgress
        });
    }
    await chrome.storage.sync.get(async function (storage) {
        ABUState.domain = checkLevels(storage, getWebpage(tabUrl, tabTitle, storage));
        const localDomain = ABUState.domain;
        if (storage[localDomain]) {
            chrome.bookmarks.search("ABUid=" + storage[localDomain].ABUid, async function (targetABUkmark) {
                if (!targetABUkmark || targetABUkmark.length === 0) {
                    await chrome.storage.sync.remove(localDomain);
                }
                else {
                    if (!(tabUrl.endsWith("/archive") && localDomain.endsWith("comic/"))) {
                        await chrome.bookmarks.update(targetABUkmark[0].id, {
                            title: `${tabTitle} (ABU)`,
                            url: createABURL(tabUrl, storage[localDomain].ABUid)
                        });
                        if (thisTab.active) {
                            await chrome.action.setIcon({ path: activeIcons });
                        }
                    }
                }
            });
        }
        else {
            if (thisTab.active) {
                await chrome.action.setIcon({ path: inactiveIcons });
            }
        }
    });
}
