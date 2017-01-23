if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

const DROPFILE_UPL_URL = "https://d2.dropfile.to/upload";

us.engy.rehostImage.dropfileUploader = function(sourceFile, destinationFilename, mimeType){
	this.sourceFile = sourceFile;
	this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
}

us.engy.rehostImage.dropfileUploader.prototype = {
	uploadedImageUrl: null,
	executeTransfer: function() {
			this.postUploader = new us.engy.rehostImage.postUploader(
				DROPFILE_UPL_URL,
				this.sourceFile,
				this.destinationFilename,
				this.mimeType,
				"files[]",
				null,
				this.uploadCallback.bind(this));
			this.postUploader.executeTransfer();
	},
	
	// parse response, get the container page link
	uploadCallback: function(request) {
		var responseJson = request.responseText;
		var responseObject = JSON.parse(responseJson);
		if (responseObject.error) {
			this.exitWithError(responseObject.error.error_message);
		} else {	
		    this.httpGetAsync(responseObject.url);
		}
	},
        
	// scrape container page for direct link
	httpGetAsync: function(containerUrl){
		var xmlHttp = new XMLHttpRequest();
		self = this;
		xmlHttp.onreadystatechange = function() { 
			if (xmlHttp.readyState == 4 && xmlHttp.status == 200){
                            var parser = new DOMParser();
                            var htmlDoc = parser.parseFromString(xmlHttp.responseText, "text/html");
                            var directLink = htmlDoc.getElementById("preview-resize").src;
                            self.uploadedImageUrl = directLink;
                            us.engy.rehostImage.main.reportUploadSuccess();
			}
		}
		xmlHttp.open("GET", containerUrl, true); // true for asynchronous 
		xmlHttp.send(null);
	},
        
	exitWithError: function(message) {
		us.engy.rehostImage.main.reportCompletion(false, message);
	},
}
