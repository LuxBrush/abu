/**
 * Type definition for the storage object used in ABU extension
 */
type ABUStorage = {
	[key: string]: {
		ABUid: string;
		favIconUrl: string;
	};
};

/**
 * Type for the storage parameter in getWebpage function
 */
type StorageObject = {
	ABUVersion?: number;
	websites: ABUStorage;
};
