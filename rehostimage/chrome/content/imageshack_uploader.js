if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

us.engy.rehostImage.imageshackUploader = function(sourceFile, destinationFilename, mimeType, userName, password){
	this.sourceFile = sourceFile;
	this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
	this.userName = userName;
	this.password = password;
}

us.engy.rehostImage.imageshackUploader.prototype = {
	postUploader: null,
	uploadedImageUrl: null,
	apiKey: "PNHM3ZTRcfcb623a7775b5d6971b8eabd381a32e",
	
	executeTransfer: function () {
		var self = this;

		var options = {
			"api_key": this.apiKey,
			"user": this.userName,
			"password": this.password
		};

		var authRequest = new XMLHttpRequest();
		authRequest.open("POST", "https://api.imageshack.com/v2/user/login");
		authRequest.setRequestHeader("Content-Type", "application/json");
		authRequest.overrideMimeType("text/plain");
		authRequest.onload = function () {
			self.authCallback(this.responseText);
		};
		authRequest.onerror = function () {
			var riBundle = document.getElementById("us.engy.rehostImage.bundle");
			us.engy.rehostImage.main.reportCompletion(false, riBundle.getString("error.disconnected"));
		};
		authRequest.send(JSON.stringify(options));
	},
	
	authCallback: function(responseJson) {
		var responseObject = JSON.parse(responseJson);
		
		if (responseObject.error) {
			this.exitWithError(responseObject.error.error_message);
		} else {
			var options = {
				"api_key": this.apiKey,
				"auth_token": responseObject.result.auth_token
			};

			this.postUploader = new us.engy.rehostImage.postUploader(
				"https://api.imageshack.com/v2/images",
				this.sourceFile,
				this.destinationFilename,
				this.mimeType,
				"file",
				options,
				this.uploadCallback.bind(this));
			this.postUploader.executeTransfer();
		}
	},
	
	uploadCallback: function(request) {
		var responseJson = request.responseText;
		var responseObject = JSON.parse(responseJson);
		
		if (responseObject.error) {
			this.exitWithError(responseObject.error.error_message);
		} else {
			var imageObject = responseObject.result.images[0];
			this.uploadedImageUrl = imageObject.direct_link;
			if (this.uploadedImageUrl.indexOf("http://") !== 0 && this.uploadedImageUrl.indexOf("https://") !== 0) {
				this.uploadedImageUrl = "http://" + this.uploadedImageUrl;
			}
			
			us.engy.rehostImage.main.reportUploadSuccess();
		}
	},

	exitWithError: function(message) {
		us.engy.rehostImage.main.reportCompletion(false, message);
	}
}