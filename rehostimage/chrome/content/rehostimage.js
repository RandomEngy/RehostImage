if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

us.engy.rehostImage.main = {
	consoleService: Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService),
	extensions: {
		"image/png": "png",
		"image/jpeg": "jpg",
		"image/pjpeg": "jpg",
		"image/gif": "gif",
		"image/bmp": "bmp",
		"image/x-windows-bmp": "bmp",
		"image/tiff": "tif",
		"image/x-tiff": "tif",
		"image/x-jg": "art",
		"image/fif": "fif",
		"image/florian": "flo",
		"image/vnd.fpx": "fpx",
		"image/vnd.net-fpx": "fpx",
		"image/g3fax": "g3",
		"image/x-icon": "ico",
		"image/x-jps": "jps",
		"image/jutvision": "jut",
		"image/vasa": "mcf",
		"image/x-portable-bitmap": "pbm",
		"image/x-pict": "pct",
		"image/x-pcx": "pcx",
		"image/x-portable-graymap": "pgm",
		"image/x-portable-greymap": "pgm",
		"image/x-portable-anymap": "pnm",
		"image/x-portable-pixmap": "ppm",
		"image/x-cmu-raster": "ras",
		"image/vnd.rn-realflash": "rf",
		"image/x-rgb": "rgb",
		"image/vnd.rn-realpix": "rp",
		"image/vnd.wap.wbmp": "wbmp",
		"image/x-xbitmap": "xbm",
		"image/x-xbm": "xbm",
		"image/xbm": "xbm",
		"image/vnd.xiff": "xif",
		"image/x-xpixmap": "xpm",
		"image/xpm": "xpm",
		"image/x-xwd": "xwd",
		"image/x-xwindowdump": "xwd"
	},

	rehostImageBundle: null,
	preferences: Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.rehostimage."),
	
	ftpConnection: null,
	imageUploader: null,
	tempFile: null,
	uploadLocation: null,
	remoteFileName: null,
	mimeType: null,
	imageSourceUrl: null,
	uploadInProgress: false,
	uploadProgressBar: null,
	imageElement: null,
	
	newHttpLocation: null,
	
	currentLocationName: null,

	onLoad: function() {
		Components.utils.import("resource://rehostimage/strings.jsm", us.engy.rehostImage);
		us.engy.rehostImage.strings.bundle = document.getElementById("us.engy.rehostImage.bundle");
		
		Components.utils.import("resource://rehostimage/database.jsm", us.engy.rehostImage);
		Components.utils.import("resource://rehostimage/configuration_helper.jsm", us.engy.rehostImage);
		Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
		Components.utils.import("resource://gre/modules/Downloads.jsm");
		
		document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", us.engy.rehostImage.main.initContextMenu, false);
	},

	initContextMenu: function() {
		var uploadLocations = us.engy.rehostImage.configurationHelper.getLocations(true);
		
		var numLocations = uploadLocations.length;
		
		gContextMenu.showItem("us.engy.rehostImage.menuItem", gContextMenu.onImage && numLocations == 1);
		gContextMenu.showItem("us.engy.rehostImage.allLocationsMenu", gContextMenu.onImage && numLocations > 1);
	},
	
	rehostImage: function(locationName) {
		this.rehostImageBundle = document.getElementById("us.engy.rehostImage.bundle");
		
		this.imageSourceUrl = gContextMenu.mediaURL;
		
		// Get the image element and extract the mime-type.
		var elem = gContextMenu.target;
		while (elem && elem.nodeType != Node.ELEMENT_NODE) {
			elem = elem.parentNode;
		}

		this.imageElement = elem;
		
		var imageRequest = elem.QueryInterface(Ci.nsIImageLoadingContent).getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
		this.mimeType = imageRequest.mimeType;
		
		// Construct the file name for the image.
		var lastSlashIndex = this.imageSourceUrl.lastIndexOf("/");
		if (lastSlashIndex < 0) {
			this.showError(this.rehostImageBundle.getString("error.sourceurlinvalid") + ": " + this.imageSourceUrl);
			return;
		}
		
		var originalFileName;
		
		if (lastSlashIndex == this.imageSourceUrl.length - 1) {
			originalFileName = "";
		} else {
			originalFileName = this.imageSourceUrl.substring(lastSlashIndex + 1)
		}
		
		this.remoteFileName = this.createRemoteFileName(originalFileName);
		
		if (this.remoteFileName == null) {
			this.showError(this.rehostImageBundle.getString("error.couldnotdetermineextension") + " " + this.mimeType);
			return;
		}
		
		// Get upload location information.
		if (locationName == null) {
			this.uploadLocation = us.engy.rehostImage.configurationHelper.getLocations()[0];
		} else {
			this.uploadLocation = us.engy.rehostImage.configurationHelper.getLocation(locationName);
		}
		
		this.currentLocationName = this.uploadLocation.name;
		
		// Ask the user to confirm the file name (if the setting is enabled)
		var preferences = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rehostimage.");
		if (this.uploadLocation.showRenameOption) {
			var fileNameArgs = { fileName: null, suggestedName: this.remoteFileName };
		
			window.openDialog("chrome://rehostimage/content/choose_filename.xul",
						null,
						"chrome,modal,dependent=yes,centerscreen=yes",
						fileNameArgs);
		
			if (fileNameArgs.fileName == null) {
				// They have cancelled, exit.
				return;
			}
			
			this.remoteFileName = fileNameArgs.fileName;
		}
		

		
		var missingField = false;
		
		if (this.uploadLocation.type == "ftp") {
			if (this.uploadLocation.host == "") {
				alert(this.rehostImageBundle.getString("error.missinghost"));
				missingField = true;
			}
			else if (this.uploadLocation.userName == "") {
				alert(this.rehostImageBundle.getString("error.missingusername"));
				missingField = true;
			}
			else if (this.uploadLocation.password == "") {
				alert(this.rehostImageBundle.getString("error.missingpassword"));
				missingField = true;
			}
			else if (this.uploadLocation.webFolder == "" || this.uploadLocation.webFolder == "http://") {
				alert(this.rehostImageBundle.getString("error.missingwebfolder"));
				missingField = true;
			}
		}
		
		if (missingField) {
			var params = { out: null, startLocationName: locationName, startPane: 0 };
			window.openDialog("chrome://rehostimage/content/options.xul", "optionsDialog", "", params);
		
			return;
		}
		
		// Show progress bar
		var panel = document.getElementById("us.engy.rehostImage.progressPanel");
		panel.openPopupAtScreen(20000, 20000, false); // Let range-checking code bring it in bounds to lower right corner.

		this.uploadProgressBar = document.getElementById("us.engy.rehostImage.uploadProgressBar");

		document.getElementById("us.engy.rehostImage.statusMessage").value = this.rehostImageBundle.getString("message.uploadprogress");
		
		this.uploadProgressBar.collapsed = false;
		this.uploadProgressBar.value = 0;
		this.uploadProgressBar.mode = "determined";
		
		this.uploadInProgress = true;
		
		var self = this;
		var tempFileProgressListener = {
			onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
				if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
					if (aStatus == Components.results.NS_OK) {
						// Make a new file object to refresh size.
						var tempFile2 = Cc["@mozilla.org/file/directory_service;1"].
							getService(Ci.nsIProperties).
							get("TmpD", Ci.nsIFile);
						tempFile2.append(self.tempFile.leafName);
						
						self.tempFile = tempFile2;
						
						// Check and see if the file needs to be resized.
						self.resizeImageIfNeeded();
					} else {
						self.reportCompletion(false, self.rehostImageBundle.getString("error.downloadfailed"));
					}
				}
			},
		
			onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
			},
		
			onLocationChange: function(aWebProgress, aRequest, aLocation) {
			},
		
			onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
			},
		
			onSecurityChange: function(aWebProgress, aRequest, aState) {
			}
		}
		
		this.tempFile = Cc["@mozilla.org/file/directory_service;1"].
				 getService(Ci.nsIProperties).
				 get("TmpD", Ci.nsIFile);
		this.tempFile.append(this.remoteFileName);
		this.tempFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
		
		var cachekey = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
		var urifix = Cc['@mozilla.org/docshell/urifixup;1'].getService(Ci.nsIURIFixup);

		var cacheUri = urifix.createFixupURI(this.imageSourceUrl, 0);
		var cacheHostUri = null;
		if (cacheUri.scheme != "data") {
			cacheHostUri = (cacheUri.host.length > 0) ? urifix.createFixupURI(cacheUri.host, 0) : null;
		}
		
		cachekey.data = this.imageSourceUrl;

		Downloads.createDownload({ source: cacheUri, target: this.tempFile }).then(
			function(download) {
				download.start().then(
					function () {
						// Make a new file object to refresh size.
						var tempFile2 = Cc["@mozilla.org/file/directory_service;1"].
							getService(Ci.nsIProperties).
							get("TmpD", Ci.nsIFile);
						tempFile2.append(self.tempFile.leafName);

						self.tempFile = tempFile2;

						// Check and see if the file needs to be resized.
						self.resizeImageIfNeeded();
					},
					function (error) {
						self.reportCompletion(false, self.rehostImageBundle.getString("error.downloadfailed") + "\n\n" + error);
					});
			},
			function (error) {
				self.reportCompletion(false, self.rehostImageBundle.getString("error.downloadfailed") + "\n\n" + error);
			});
	},

	resizeImageIfNeeded: function() {
		var self = this;
		if (this.uploadLocation.resizeEnable) {
			var img = new Image();  
			var self = this;
			img.onload = function(){
				var maxWidth = self.uploadLocation.resizeWidth;
				var maxHeight = self.uploadLocation.resizeHeight;
				
				if ((maxWidth > 0 && img.width > maxWidth) || (maxHeight > 0 && img.height > maxHeight)) {
					var resizeToWidth;
					if (maxHeight == 0) {
						resizeToWidth = true;
					} else if (maxWidth == 0) {
						resizeToWidth = false;
					} else {
						var widthRatio = img.width / maxWidth;
						var heightRatio = img.height / maxHeight;
						
						resizeToWidth = widthRatio > heightRatio;
					}
					
					var resizeFactor;
					if (resizeToWidth) {
						resizeFactor = maxWidth / img.width;
					} else {
						resizeFactor = maxHeight / img.height;
					}
					
					var newWidth = img.width * resizeFactor;
					var newHeight = img.height * resizeFactor;
					
					var newCanvas = document.createElementNS("http://www.w3.org/1999/xhtml", "html:canvas")
					
					newCanvas.width = newWidth;
					newCanvas.height = newHeight;
					
					var ctx = newCanvas.getContext("2d");
					
					try {
						ctx.drawImage(img, 0, 0, newWidth, newHeight);
					} catch (exception) {
						this.reportCompletion(false, self.rehostImageBundle.getString("error.resizefailed") + "\n\n" + self.rehostImageBundle.getString("message.details") + "\n" + exception);
						return;
					}
					
					self.tempFile.remove(false);
					
					// Update the type and remote file name for the image
					var configuredSaveType = self.uploadLocation.resizeFormat;
					if (configuredSaveType == "JPG") {
						self.mimeType = "image/jpeg";
						self.changeRemoteExtension("jpg");
					} else if (configuredSaveType == "PNG") {
						self.mimeType = "image/png";
						self.changeRemoteExtension("png");
					}
					
					var resizedTempFile = Cc["@mozilla.org/file/directory_service;1"].
							 getService(Ci.nsIProperties).
							 get("TmpD", Ci.nsIFile);
					resizedTempFile.append(self.remoteFileName);
					resizedTempFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
					
					self.tempFile = resizedTempFile;
					
					self.saveCanvas(newCanvas, resizedTempFile);
				} else {
					self.executeTransfer();
				}
			}
			 
			var tempFileUri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newFileURI(this.tempFile);
			
			img.src = tempFileUri.spec;
		} else {
			this.executeTransfer();
		}
	},
	
	changeRemoteExtension: function(newExtension) {
		var dotIndex = this.remoteFileName.lastIndexOf(".");
		
		this.remoteFileName = this.remoteFileName.substring(0, dotIndex) + "." + newExtension;
	},
	
	saveCanvas: function(canvas, destFile) {
		// create a data url from the canvas and then create URIs of the source and targets    
		var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		
		var imageSaveParameter;
		
		var configuredSaveType = this.uploadLocation.resizeFormat;
		
		if (configuredSaveType == "JPG") {
			imageSaveParameter = "quality=" + this.uploadLocation.resizeQuality;
		} else if (configuredSaveType == "PNG") {
			imageSaveParameter = "";
		}
		
		var source = io.newURI(canvas.toDataURL(this.mimeType, imageSaveParameter), "UTF8", null);  
		var target = io.newFileURI(destFile);

		var self = this;

		Downloads.createDownload({ source: source, target: destFile }).then(
			function (download) {
				download.start().then(
					function () {
						// Make a new file object to refresh size.
						var tempFile3 = Cc["@mozilla.org/file/directory_service;1"].
							getService(Ci.nsIProperties).
							get("TmpD", Ci.nsIFile);
						tempFile3.append(self.tempFile.leafName);

						self.tempFile = tempFile3;

						self.executeTransfer();
					},
					function (error) {
						self.reportCompletion(false, self.rehostImageBundle.getString("error.resizefailed") + "\n\n" + error);
					});
			},
			function (error) {
				self.reportCompletion(false, self.rehostImageBundle.getString("error.resizefailed") + "\n\n" + error);
			});
	},
	
	executeTransfer: function() {
		switch (this.uploadLocation.type) {
			case "ftp":
				this.ftpConnection = new us.engy.rehostImage.ftpConnection(this.uploadLocation.host, this.uploadLocation.userName, this.uploadLocation.password, this.uploadLocation.remoteDirectory, this.tempFile, this.remoteFileName);
				this.ftpConnection.executeTransfer();
				break;
			case "imgur":
				this.imageUploader = new us.engy.rehostImage.imgurUploader(this.tempFile, this.remoteFileName, "", false);
				this.imageUploader.executeTransfer();
				break;
			case "imageshack":
				this.imageUploader = new us.engy.rehostImage.imageshackUploader(this.tempFile, this.remoteFileName, this.mimeType, this.uploadLocation.userName, this.uploadLocation.password);
				this.imageUploader.executeTransfer();
				break;
			default:
				alert("Unknown location type: " + this.uploadLocation.type);
				break;
		}
	},

	reportProgress: function(percentComplete) {
		this.uploadProgressBar.value = percentComplete;
	},

	reportUploadSuccess: function() {
		this.newHttpLocation = this.getNewHttpLocation();
		var self = this;
		
		if (this.uploadLocation.shortenUrl) {
			var req = new XMLHttpRequest();
			req.open("POST", "https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyAYI8DePgz5Z8WplGYjo0Wh6cGXnEkR1YA");
			req.setRequestHeader("Content-Type", "application/json");
			req.onreadystatechange = function(evt) {
				if (req.readyState == 4) {
					if (req.status == 200) {
						var responseObject = JSON.parse(req.responseText);
						self.newHttpLocation = responseObject.id;
					} else {
						self.showError(self.rehostImageBundle.getString("error.googleshortenfailed"));
					}
					
					self.reportCompletion(true);
				}
			};
			
			req.send('{"longUrl": "' + this.newHttpLocation + '"}');
		} else {
			self.reportCompletion(true);
		}
	},

	reportCompletion: function(succeeded, errorMessage) {
		this.uploadInProgress = false;
		document.getElementById("us.engy.rehostImage.uploadProgressBar").collapsed = true;
		
		var panel = document.getElementById("us.engy.rehostImage.progressPanel");

		if (this.tempFile != null && this.tempFile.exists()) {
			this.tempFile.remove(false);
		}
		
		if (succeeded) {
			// Copy the new URL to the clipboard.
			var gClipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);
			gClipboardHelper.copyString(this.newHttpLocation);

			var successMessage = this.rehostImageBundle.getString("message.success");
			
			var self = this;
			document.getElementById("us.engy.rehostImage.statusMessage").value = successMessage;
	
			// Show the message for 8 seconds.
			setTimeout(function() {
				if (!self.uploadInProgress) {
					panel.hidePopup();
				}
			}, 8000);
			
			// Log this upload
			this.logUpload(this.imageSourceUrl, this.newHttpLocation);
		} else {
			panel.hidePopup();
			this.showError(errorMessage);
		}
	},

	progressClick: function() {
		if (!this.uploadInProgress) {
			var panel = document.getElementById("us.engy.rehostImage.progressPanel");
			panel.hidePopup();
		}
	},

	getNewHttpLocation: function() {
		if (this.uploadLocation.type == "ftp") {
			// Determine what HTTP URL the new image is.
			var httpDirectory = this.uploadLocation.webFolder;
			if (httpDirectory[httpDirectory.length - 1] != "/") {
				httpDirectory += "/";
			}
			
			return httpDirectory + encodeURIComponent(this.ftpConnection.destinationFilename);
		} else {
			return this.imageUploader.uploadedImageUrl;
		}
	},

	showError: function(errorMessage) {
		var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
		prompts.alert(window, this.rehostImageBundle.getString("error.general"), errorMessage);
	},

	logUpload: function(sourceUrl, destinationUrl) {
		if (!this.preferences.getBoolPref("historyenabled")) {
			return;
		}
		
	    // Don't log when in private browsing mode
		var isPrivate = PrivateBrowsingUtils.isWindowPrivate(window);
		if (isPrivate) {
		    return;
		}
		
		var dbConnection = us.engy.rehostImage.database.getDBConnection();
		
		var insertStatement = dbConnection.createStatement("INSERT INTO uploadHistory (sourceUrl, destinationUrl, uploadedTime) VALUES (:sourceUrl, :destinationUrl, datetime('now'))");
		insertStatement.params.sourceUrl = sourceUrl;
		insertStatement.params.destinationUrl = destinationUrl;
		
		insertStatement.executeAsync();
	},

	interrogate: function(objectToDump) {
		var output = '';
		for (var i in objectToDump)
			output += i + '\n';
		alert(output);
	},

	createRemoteFileName: function(originalFileName) {
		var newExtension;

		if (originalFileName == "") {
			newExtension = this.extensions[this.mimeType];
			if (newExtension != null) {
				return this.getRandomString(5) + "." + newExtension;
			}

			return null;
		}

		var disallowedcharacters = ["\\", "/", ":", "?", "\"", "<", ">", "|", "&"];

		var cleanFileName = originalFileName;
		cleanFileName = decodeURIComponent(cleanFileName);

		for (var i = 0; i < disallowedcharacters.length; i++) {
			cleanFileName = cleanFileName.replace(disallowedcharacters[i], "_");
		}

		var dotIndex = cleanFileName.lastIndexOf(".");

		if (dotIndex < 0 || dotIndex == cleanFileName.length - 1) {
			newExtension = this.extensions[this.mimeType];

			if (newExtension != null) {
				return cleanFileName + "." + newExtension;
			}

			return null;
		}

		if (this.extensions[this.mimeType] != null) {
			newExtension = this.extensions[this.mimeType];
		} else {
			newExtension = cleanFileName.substring(dotIndex + 1);

			// If the extension contains any underscores, it's probably taking the query string, so we've failed.
			if (newExtension.indexOf("_") > 0) {
				return null;
			}
		}

		var fileNameWithoutExtension = cleanFileName.substring(0, dotIndex);

		return fileNameWithoutExtension + "." + newExtension;
	},

	getRandomString: function(numCharacters) {
		var chars = "0123456789abcdefghiklmnopqrstuvwxyz";
		var randomString = "";
		for (var i = 0; i < numCharacters; i++) {
			var randomNumber = Math.floor(Math.random() * chars.length);
			randomString += chars[randomNumber];
		}

		return randomString;
	},
	
	findNewFilename: function(baseFileName, fileList) {
		var dotIndex = baseFileName.lastIndexOf(".");

		var fileNameWithoutExtension = baseFileName.substring(0, dotIndex);
		var extension = baseFileName.substring(dotIndex + 1);

		var differentiator = "";
		
		var fileListLower = fileList.toLowerCase();
		var fileNameWithoutExtensionLower = fileNameWithoutExtension.toLowerCase();
		var extensionLower = extension.toLowerCase();
		
		for (var i = 2; i < 20; i++) {
			if (fileListLower.indexOf(fileNameWithoutExtensionLower + "_" + i + "." + extensionLower) < 0) {
				differentiator = i;
				break;
			}
		}
		
		if (differentiator == "") {
			differentiator = this.getRandomString(5);
		}

		return fileNameWithoutExtension + "_" + differentiator + "." + extension;
	},

	initMenuPopup: function() {
		var popupMenu = document.getElementById("us.engy.rehostImage.allLocationsPopup");

		var children = popupMenu.childNodes;
		
		var i;
		for (i = children.length - 1; i >= 0; i--) {
			popupMenu.removeChild(children[i]);
		}

		var uploadLocations = us.engy.rehostImage.configurationHelper.getLocations(true);
		
		var createCommandListener = function(locName) {
			return function() { us.engy.rehostImage.main.rehostImage(locName); };
		}
		
		for (i = 0; i < uploadLocations.length; i++) {
			var locationName = uploadLocations[i].name;
			var item = document.createElement("menuitem");
			
			item.setAttribute("id", "us.engy.rehostImage.menuChoice" + i);
			item.setAttribute("label", locationName);
			item.addEventListener(
				"command",
				createCommandListener(locationName),
				false);

			popupMenu.appendChild(item);
		}
	}
};

window.addEventListener("load", us.engy.rehostImage.main.onLoad, false);