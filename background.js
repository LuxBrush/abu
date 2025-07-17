chrome.runtime.onConnect.addListener((port) => {
	port.onMessage.addListener((message) => {
		console.log("Placeholder inbound message:", message);
		port.postMessage("Placeholder outbound message.");
	});
});
