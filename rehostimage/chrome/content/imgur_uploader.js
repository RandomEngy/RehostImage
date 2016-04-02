if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

us.engy.rehostImage.imgurUploader = function(sourceFile, destinationFilename, mimeType, anonymous){
	this.sourceFile = sourceFile;
	this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
	this.anonymous = anonymous;
}

us.engy.rehostImage.imgurUploader.prototype = {
	uploadedImageUrl: null,
	
	executeTransfer: function() {
		var riBundle = document.getElementById("us.engy.rehostImage.bundle");
		Components.utils.import("resource://rehostimage/imgur3.jsm");
		
		var self = this;
		
		Imgur3RI.initialize();
		
		var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
						  .createInstance(Components.interfaces.nsIFileInputStream);
		inputStream.init(this.sourceFile, 0x01, 0600, 0);
		var binaryStream = Components.classes["@mozilla.org/binaryinputstream;1"]
							 .createInstance(Components.interfaces.nsIBinaryInputStream);
		binaryStream.setInputStream(inputStream);
		var base64Image = btoa(binaryStream.readBytes(binaryStream.available()));
		
		binaryStream.close();
		inputStream.close();
		
		Imgur3RI.upload(
			base64Image,
			function(evt) {
				if (evt.lengthComputable) {
					var percentComplete = (evt.loaded * 100) / evt.total; 
					us.engy.rehostImage.main.reportProgress(percentComplete);
				} else {
					// Unable to compute progress information since the total size is unknown  
				}  
			},
			function(imageLink) {
				self.uploadedImageUrl = imageLink;
				us.engy.rehostImage.main.reportUploadSuccess();
			},
			function(request) {
				us.engy.rehostImage.main.reportCompletion(false, riBundle.getString("error.uploadfailed") + "\n\n" + request.status + " " + request.statusText + "\n\n" + request.responseText);
			}
		);
	}
}