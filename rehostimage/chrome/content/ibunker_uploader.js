if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

us.engy.rehostImage.iBunkerUploader = function(sourceFile, destinationFilename, mimeType){
    this.sourceFile = sourceFile;
    this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
}

us.engy.rehostImage.iBunkerUploader.prototype = {
	postUploader: null,
	uploadedImageUrl: null,
	
	executeTransfer: function() {
		var options = {
			"agb": "1",
			"private": "1",
			"user_nickmail": "",
			"user_pw": ""
		};
		
		// The .bind function was added in FF 4. Can't use yet, so we manually pass a reference back to this object.
		this.postUploader = new us.engy.rehostImage.postUploader(
			"http://ibunker.us/api/upload.php",
			this.sourceFile,
			this.destinationFilename,
			this.mimeType,
			"file_1",
			options,
			this.uploadCallback,
			this);
		//this.postUploader = new us.engy.rehostImage.postUploader("http://ibunker.us/api/upload.php", this.sourceFile, this.destinationFilename, this.mimeType, "file_1", options, this.uploadCallback.bind(this));
		this.postUploader.executeTransfer();
	},
	
	uploadCallback: function(request, self) {
		var riBundle = document.getElementById("us.engy.rehostImage.bundle");
		var responseText = request.responseText;
		
		var startIndex = responseText.indexOf("[img]");
		var endIndex = responseText.indexOf("[/img]");
		
		if (startIndex < 0 || endIndex < 0) {
			self.exitWithError("Unknown response format:\n\n" + responseText);
			return;
		}
		
		self.uploadedImageUrl = responseText.substring(startIndex + 5, endIndex);
		us.engy.rehostImage.main.reportUploadSuccess();
	},
	
	exitWithError: function(message) {
		us.engy.rehostImage.main.reportCompletion(false, message);
	}
}