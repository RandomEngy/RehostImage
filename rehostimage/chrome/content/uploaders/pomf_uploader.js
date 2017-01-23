if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

const POMF_UPL_URL = "https://pomf.cat/upload.php";
const POMF_IMG_URL = "https://a.pomf.cat/"

us.engy.rehostImage.pomfUploader = function(sourceFile, destinationFilename, mimeType){
	this.sourceFile = sourceFile;
	this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
}

us.engy.rehostImage.pomfUploader.prototype = {
	uploadedImageUrl: null,
	executeTransfer: function() {
			this.postUploader = new us.engy.rehostImage.postUploader(
				POMF_UPL_URL,
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
			this.uploadedImageUrl = POMF_IMG_URL + imageObject.url;			
			us.engy.rehostImage.main.reportUploadSuccess();
		}
	},

	exitWithError: function(message) {
		us.engy.rehostImage.main.reportCompletion(false, message);
	},
}