interface commData {
	function: string;
	data: {};
}

type BookmarkData = {
	bookmarkKey: string;
	bookmarkId: string;
	favIconUrl: string;
};

interface BookmarkCommData {
	function: "saveBookmarkData";
	data: BookmarkData;
}

type Functions = {
	[key: string]: (...args: any[]) => any;
};
