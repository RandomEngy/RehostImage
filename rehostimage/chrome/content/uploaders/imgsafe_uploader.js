if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

const IMGSAFE_UPL_URL = "https://imgsafe.org/upload";

us.engy.rehostImage.imgsafeUploader = function(sourceFile, destinationFilename, mimeType){
	this.sourceFile = sourceFile;
	this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
}

us.engy.rehostImage.imgsafeUploader.prototype = {
	uploadedImageUrl: null,
	executeTransfer: function() {
			this.postUploader = new us.engy.rehostImage.postUploader(
				IMGSAFE_UPL_URL,
				this.sourceFile,
				this.destinationFilename,
				this.mimeType,
				"files[]",
				null,
				this.uploadCallback.bind(this));
			this.postUploader.executeTransfer();
	},
	
	// parse response for image url
	uploadCallback: function(request) {
		var responseJson = request.responseText;
		var responseObject = JSON.parse(responseJson);
		if (responseObject.error) {
			this.exitWithError(responseObject.error.error_message);
		} else {
			var imageObject = responseObject.files[0];
			this.uploadedImageUrl = imageObject.url.substring(2); //exmple response: url = "//i.imgsafe.org/4efe5d658e.jpg"
			us.engy.rehostImage.main.reportUploadSuccess();
		}
	},

	exitWithError: function(message) {
		us.engy.rehostImage.main.reportCompletion(false, message);
	},
}