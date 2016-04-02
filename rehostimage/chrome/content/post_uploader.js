if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

us.engy.rehostImage.postUploader = function(postUrl, sourceFile, destinationFilename, mimeType, formFileField, options, uploadCallback){
	this.postUrl = postUrl;
	this.sourceFile = sourceFile;
	this.destinationFilename = destinationFilename;
	this.mimeType = mimeType;
	this.formFileField = formFileField;
	this.options = options;
	this.uploadCallback = uploadCallback;
}

us.engy.rehostImage.postUploader.prototype = {
	request: null,
	
	fileStream: null,
	bufferedFileStream: null,
	prefixStream: null,
	suffixStream: null,
	multiStream: null,
	
	executeTransfer: function() {
		const boundary = "---------------------------2712608946";
		const leftBoundary = "--" + boundary;
		
		// Set up the multi-stream
		this.multiStream = Cc["@mozilla.org/io/multiplex-input-stream;1"].createInstance(Ci.nsIMultiplexInputStream);
		
		// Open the file stream
		this.fileStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
		this.fileStream.init(this.sourceFile, -1, 0, Ci.nsIFileInputStream.CLOSE_ON_EOF);
		this.bufferedFileStream = Cc["@mozilla.org/network/buffered-input-stream;1"].createInstance(Ci.nsIBufferedInputStream);
		this.bufferedFileStream.init(this.fileStream, 4096);
		
		// Set up the prefix of the POST data
		this.prefixStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
		var prefixString = new String();
		prefixString += leftBoundary + "\r\n";
		
		for (var optionName in this.options) {
			prefixString += "Content-Disposition: form-data; name=\"" + optionName + "\"\r\n\r\n" + this.options[optionName] + "\r\n" + leftBoundary + "\r\n";
		}
		
		prefixString += "Content-Disposition: form-data; name=\"" + this.formFileField + "\"; filename=\"" + this.destinationFilename + "\"\r\n";
		prefixString += "Content-Type: " + this.mimeType + "\r\n\r\n";
		this.prefixStream.setData(prefixString, prefixString.length);
		
		// Set up the suffix of the POST data
		this.suffixStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
		var suffixString = new String("\r\n" + leftBoundary + "--\r\n");
		this.suffixStream.setData(suffixString, suffixString.length);
		
		// Compose the streams
		this.multiStream.appendStream(this.prefixStream);
		this.multiStream.appendStream(this.bufferedFileStream);
		this.multiStream.appendStream(this.suffixStream);
		
		var self = this;
		
		// Send the request
		this.request = new XMLHttpRequest();
		
		this.request.upload.addEventListener("progress", this.uploadProgress, false);
		
		this.request.open("POST", this.postUrl, true);
		this.request.onerror = function() {
			var riBundle = document.getElementById("us.engy.rehostImage.bundle");
			self.exitWithError(riBundle.getString("error.disconnected"));
		};
		this.request.onreadystatechange = function (event) {
			self.onStateChange();
		};

		this.request.setRequestHeader("Content-Length", this.multiStream.available());
		this.request.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
		
		this.request.send(this.multiStream);
	},
	
	onStateChange: function() {
		if (this.request.readyState == 4) {
			var riBundle = document.getElementById("us.engy.rehostImage.bundle");
			
			if (this.request.status == 200) {
				this.uploadCallback(this.request);
				
				this.close();
			} else {
				this.exitWithError(riBundle.getString("error.uploadfailed") + "\n" + this.request.status + " " + this.request.statusText);
			}
		}
	},
	
	uploadProgress: function(evt) {
		if (evt.lengthComputable) {
			var percentComplete = (evt.loaded * 100) / evt.total; 
			us.engy.rehostImage.main.reportProgress(percentComplete);
		} else {
			// Unable to compute progress information since the total size is unknown  
		}  
	},
	
	exitWithError: function(message) {
		us.engy.rehostImage.main.reportCompletion(false, message);
		this.close();
	},
	
	close: function() {
		if (this.fileStream) {
			this.fileStream.close();
		}
		
		if (this.bufferedFileStream) {
			this.bufferedFileStream.close();
		}
		
		if (this.prefixStream) {
			this.prefixStream.close();
		}
		
		if (this.suffixStream) {
			this.suffixStream.close();
		}
		
		if (this.multiStream) {
			this.multiStream.close();
		}
	}
}