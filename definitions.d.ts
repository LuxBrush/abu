/**
 * Type definition for the storage object used in ABU extension
 */
type ABUStorage = {
	ABUid: number;
	favIconUrl: string;
};

/**
 * Type for the storage parameter in getWebpage function
 */
interface StorageObject {
	ABUVersion?: number;
	[key: string]: ABUStorage | undefined;
}
