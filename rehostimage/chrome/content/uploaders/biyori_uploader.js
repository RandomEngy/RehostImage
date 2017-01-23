if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

const BIYORI_UPL_URL = "https://biyori.moe/api/user/upload";

us.engy.rehostImage.biyoriUploader = function(sourceFile, destinationFilename, mimeType){
	this.sourceFile = sourceFile;
	this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
}

us.engy.rehostImage.biyoriUploader.prototype = {
	uploadedImageUrl: null,
	executeTransfer: function() {
	    var options = {
			"name": this.destinationFilename
		};
		
		this.postUploader = new us.engy.rehostImage.postUploader(
			BIYORI_UPL_URL,
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
			this.uploadedImageUrl = responseObject.url;			
			us.engy.rehostImage.main.reportUploadSuccess();
		}
	},

	exitWithError: function(message) {
		us.engy.rehostImage.main.reportCompletion(false, message);
	},
}