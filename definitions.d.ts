// One ABUkmark entry stored under a scope key (domain/special token)
interface ABUEntry {
	ABUid: number;
	favIconUrl: string;
}

// A scope key is a normalized domain/path or a special token
// Examples: "example.com/path/", "webtoons.com/en/romance/title/",
//            "docs.google.com/presentation/d/<id>/", "?v=VIDEOID", "Cool Comic Title"
type ScopeKey = string;

// Full storage object for chrome.storage.sync used by this extension
// - ABUVersion is a special top-level numeric entry
// - All other keys map to ABUEntry
type ABUStorage = { ABUVersion?: number } & Record<ScopeKey, ABUEntry>;
