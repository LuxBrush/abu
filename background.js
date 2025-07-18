chrome.runtime.onConnect.addListener((port) => {
	port.onMessage.addListener((/** @type {commData} */ message) => {
		const updatedData = functions[message.function](message.data);
		if (updatedData) {
			port.postMessage(updatedData);
		}
	});
});

/** @type {Functions} */
const functions = {
	/**
	 * Stores bookmark data in Chrome's synced storage
	 * @param {BookmarkData} data - An object containing the bookmark key, bookmark id, and favicon url
	 * @returns {boolean} Returns true if the operation was successful, false otherwise
	 */
	saveBookmarkData(data) {
		try {
			const { bookmarkKey, bookmarkId, favIconUrl } = data;
			const storageData = { [bookmarkKey]: { "ABUid": bookmarkId, favIconUrl } };
			chrome.storage.sync.set(storageData, () => {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError);
					return false;
				}
			});
			chrome.storage.sync.get((/** @type {any} */ data) => {
				console.log(data);
			});
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	},
};
