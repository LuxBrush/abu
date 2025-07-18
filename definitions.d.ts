/**
 * Data structure for a single ABUkmark entry
 * Contains the bookmark's unique identifier and favicon URL
 */
type ABUBookmarkData = {
	/** Unique identifier for the ABUkmark */
	"ABUid": string;
	/** URL of the favicon for the bookmarked page */
	"favIconUrl": string;
};

/**
 * Storage structure for ABUkmarks
 * Maps webpage identifiers to their associated bookmark data
 */
type ABUStorage = { [key: string]: ABUBookmarkData };

/**
 * Base interface for communication data between content scripts and background script
 * Serves as a generic message structure for extension messaging
 */
interface commData {
	/** Name of the function to be executed by the background script */
	functionName: string;
	/** Object containing data relevant to the function being called */
	properties: {};
}

/**
 * Properties required for saving bookmark data
 * Contains the necessary information to create or update an ABUkmark
 */
type BookmarkProperties = {
	/** The normalized webpage identifier used as storage key */
	bookmarkKey: string;
	/** Chrome bookmark ID associated with this ABUkmark */
	bookmarkId: number;
	/** URL of the favicon for the bookmarked page */
	favIconUrl: string;
};

/**
 * Message structure for saving bookmark data to storage
 * Used to communicate bookmark information to the background script
 */
interface BookmarkCommData {
	/** Fixed function name for saving bookmark data */
	functionName: "saveBookmarkData";
	/** Properties required to save a bookmark */
	properties: BookmarkProperties;
}

/**
 * Properties required for generating a normalized webpage identifier
 * Used as input for the getWebPageId function to create consistent identifiers
 * for ABUkmark storage across different websites and URL formats
 */
type WebPageIdProperties = {
	/** The full URL of the webpage to normalize */
	url: string;
	/** Title of the webpage, used for special cases (e.g., Tapas) */
	title: string;
	/** Storage object to check against when determining the appropriate identifier level */
	storage: ABUStorage;
};

/**
 * Message structure for communication with the background script
 * Used to request a normalized webpage identifier via postMessage
 */
interface WebPageIdCommData {
	/** Fixed function name for getting a webpage identifier */
	functionName: "getWebPageId";
	/** Properties required to generate a webpage identifier */
	properties: WebPageIdProperties;
}

/**
 * Dictionary of functions mapped by name
 * Used for dynamic function lookup and execution in the extension
 */
type Functions = {
	/** Map of function names to their implementations */
	[key: string]: (...args: any[]) => any;
};
