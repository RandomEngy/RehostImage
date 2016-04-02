var EXPORTED_SYMBOLS = ["configurationHelper"];

Components.utils.import("resource://rehostimage/password_manager.jsm");
Components.utils.import("resource://rehostimage/database.jsm");

var Cc = Components.classes;
var Ci = Components.interfaces;

var configurationHelper = {
	cachedUploadLocations: null,
	cachedUploadLocationsIncludesPasswords: false,
	
	setLocations: function(locations) {
		var dbConnection = database.getDBConnection();
		
		var statements = new Array(locations.length + 1);
		
		var clearStatement = dbConnection.createStatement("DELETE FROM locations");
		statements[0] = clearStatement;
		
		var insertStatement;
		
		for (var i = 0; i < locations.length; i++) {
			var location = locations[i];
			
			insertStatement = dbConnection.createStatement("INSERT INTO locations " +
				"(name, type, imageshackAnonymous, host, userName, remoteDirectory, webFolder, showRenameOption, shortenUrl, resizeEnable, resizeWidth, resizeHeight, resizeFormat, resizeQuality) VALUES " +
				"(:name, :type, :imageshackAnonymous, :host, :userName, :remoteDirectory, :webFolder, :showRenameOption, :shortenUrl, :resizeEnable, :resizeWidth, :resizeHeight, :resizeFormat, :resizeQuality)");
			insertStatement.params.name = location.name;
			insertStatement.params.type = location.type;
			
			insertStatement.params.showRenameOption = location.showRenameOption;
			insertStatement.params.shortenUrl = location.shortenUrl;
			insertStatement.params.resizeEnable = location.resizeEnable;
			insertStatement.params.resizeWidth = location.resizeWidth;
			insertStatement.params.resizeHeight = location.resizeHeight;
			insertStatement.params.resizeFormat = location.resizeFormat;
			insertStatement.params.resizeQuality = location.resizeQuality;
			
			switch (location.type) {
				case "ftp":
					insertStatement.params.host = location.host;
					insertStatement.params.userName = location.userName;
					insertStatement.params.remoteDirectory = location.remoteDirectory;
					insertStatement.params.webFolder = location.webFolder;
					break;
				case "imageshack":
					insertStatement.params.imageshackAnonymous = false;
					insertStatement.params.userName = location.userName;
					break;
				default:
					break;
			}
			
			statements[i + 1] = insertStatement;
		}
		
		this.cachedUploadLocations = this.getCloneOfArray(locations);
		this.cachedUploadLocationsIncludesPasswords = true;
		dbConnection.executeAsync(statements, statements.length);

		passwordManager.setPasswords(locations);
	},

	getLocations: function(suppressPasswords) {
		if (this.cachedUploadLocations && (this.cachedUploadLocationsIncludesPasswords || suppressPasswords)) {
			return this.getCloneOfArray(this.cachedUploadLocations);
		}
		
		var preferences = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rehostimage.");
		var uploadLocations;
		
		// First check for old settings. If they exist, move them over and wipe them.
		if (preferences.prefHasUserValue("uploadlocations")) {
			uploadLocations = new Array();
	
			var uploadLocationsString = preferences.getCharPref("uploadlocations");
	
			if (uploadLocationsString != null) {
				var locationParts = uploadLocationsString.split("|");
	
				for (var i = 0; i < locationParts.length; i++) {
					var infoParts = locationParts[i].split("*");
					var uploadLocation = new Object();
					
					uploadLocation.name = infoParts[0];
					
					var oldConfig = infoParts[1] != "ftp" && infoParts[1] != "imageshack";
					
					if (oldConfig) {
						uploadLocation.host = infoParts[1];
						uploadLocation.username = infoParts[2];
						uploadLocation.remotedirectory = infoParts[3];
						uploadLocation.webfolder = infoParts[4];
						
						if (infoParts.length > 5) {
							uploadLocation.type = infoParts[5];
						}
						else {
							uploadLocation.type = "ftp";
						}
					} else {
						uploadLocation.type = infoParts[1];
						
						if (uploadLocation.type == "ftp") {
							uploadLocation.host = infoParts[2];
							uploadLocation.userName = infoParts[3];
							uploadLocation.remoteDirectory = infoParts[4];
							uploadLocation.webFolder = infoParts[5];
						} else if (uploadLocation.type == "imageshack") {
							uploadLocation.anonymous = infoParts[2] == "true";
							uploadLocation.registrationCode = infoParts[3];
							
							if (infoParts.length > 4) {
								uploadLocation.includeResolutionBar = infoParts[4] == "true";
							} else {
								uploadLocation.includeResolutionBar = true;
							}
						}
					}
					
					this.applyDefaults(uploadLocation);
					
					if (preferences.prefHasUserValue("showrenameoption")) {
						uploadLocation.showRenameOption = preferences.getBoolPref("showrenameoption");
					}
					
					if (preferences.prefHasUserValue("shortenurl")) {
						uploadLocation.shortenUrl = preferences.getBoolPref("shortenurl");
					}
					
					if (preferences.prefHasUserValue("resizeenabled")) {
						uploadLocation.resizeEnable = preferences.getBoolPref("resizeenabled");
					}
					
					if (preferences.prefHasUserValue("resizewidth")) {
						uploadLocation.resizeWidth = preferences.getIntPref("resizewidth");
					}
					
					if (preferences.prefHasUserValue("resizeheight")) {
						uploadLocation.resizeHeight = preferences.getIntPref("resizeheight");
					}
					
					if (preferences.prefHasUserValue("resizeformat")) {
						uploadLocation.resizeFormat = preferences.getCharPref("resizeformat");
					}
					
					if (preferences.prefHasUserValue("resizequality")) {
						uploadLocation.resizeQuality = preferences.getIntPref("resizequality");
					}
					
					uploadLocations.push(uploadLocation);
				}
			}
			
			this.setLocations(uploadLocations);
			preferences.clearUserPref("uploadlocations");
			
			this.clearPrefs(preferences, ["showrenameoption", "shortenurl", "resizeenabled", "resizewidth", "resizeheight", "resizeformat", "resizequality"]);
			
			this.applyPasswordsAndCache(uploadLocations, !suppressPasswords);
			
			return uploadLocations;
		}
		
		// Load upload locations from DB
		uploadLocations = new Array();
		
		var dbConnection = database.getDBConnection();
		var selectStatement = dbConnection.createStatement("SELECT * FROM locations");
		while (selectStatement.executeStep()) {
			var row = selectStatement.row;
			var uploadLocation = new Object();
			
			uploadLocation.name = row.name;
			uploadLocation.type = row.type;
			
			uploadLocation.showRenameOption = row.showRenameOption;
			uploadLocation.shortenUrl = row.shortenUrl;
			uploadLocation.resizeEnable = row.resizeEnable;
			uploadLocation.resizeWidth = row.resizeWidth;
			uploadLocation.resizeHeight = row.resizeHeight;
			uploadLocation.resizeFormat = row.resizeFormat;
			uploadLocation.resizeQuality = row.resizeQuality;
			
			switch (uploadLocation.type) {
				case "ftp":
					uploadLocation.host = row.host;
					uploadLocation.userName = row.userName;
					uploadLocation.remoteDirectory = row.remoteDirectory;
					uploadLocation.webFolder = row.webFolder;
					break;
				case "imageshack":
					uploadLocation.userName = row.userName;
					break;
				default:
					break;
			}
			
			uploadLocations.push(uploadLocation);
		}
		
		this.applyPasswordsAndCache(uploadLocations, !suppressPasswords);
		
		return uploadLocations;
	},
	
	clearPrefs: function(preferences, prefArray) {
		for (var i = 0; i < prefArray.length; i++) {
			if (preferences.prefHasUserValue(prefArray[i])) {
				preferences.clearUserPref(prefArray[i]);
			}
		}
	},
	
	applyDefaults: function(uploadLocation) {
		uploadLocation.showRenameOption = false;
		uploadLocation.shortenUrl = false;
		uploadLocation.resizeEnable = false;
		uploadLocation.resizeWidth = 800;
		uploadLocation.resizeHeight = 600;
		uploadLocation.resizeFormat = "JPG";
		uploadLocation.resizeQuality = 80;
	},
	
	applyPasswordsAndCache: function(uploadLocations, includePasswords) {
		if (includePasswords) {
			passwordManager.populatePasswords(uploadLocations);
		}
		
		this.cachedUploadLocations = this.getCloneOfArray(uploadLocations);
		this.cachedUploadLocationsIncludesPasswords = includePasswords;
	},
	
	getLocation: function(locationName) {
		var uploadLocations = this.getLocations();
		
		for (var i = 0; i < uploadLocations.length; i++) {
			if (locationName == uploadLocations[i].name) {
				return uploadLocations[i];
			}
		}
		
		return null;
	},

	getCloneOfObject: function(oldObject) {
		var tempClone = {};
		
		if (typeof(oldObject) == "object") {
			for (prop in oldObject) {
				if (oldObject[prop] === null) {
					tempClone[prop] = null;
				} else if ((typeof(oldObject[prop]) == "object") && (oldObject[prop]).__isArray) {
					// for array use private method getCloneOfArray
					tempClone[prop] = this.getCloneOfArray(oldObject[prop]);
				} else if (typeof(oldObject[prop]) == "object") {
					// for object make recursive call to getCloneOfObject
					tempClone[prop] = this.getCloneOfObject(oldObject[prop]);
				} else {
					// normal (non-object type) members
					tempClone[prop] = oldObject[prop];
				}
			}
		}
		
		return tempClone;
	},

	getCloneOfArray: function(oldArray) {
		var tempClone = new Array();
		
		for (var arrIndex = 0; arrIndex < oldArray.length; arrIndex++) {
			if (typeof(oldArray[arrIndex]) == "object") {
				tempClone.push(this.getCloneOfObject(oldArray[arrIndex]));
			} else {
				tempClone.push(oldArray[arrIndex]);
			}
		}
		return tempClone;
	},

	cleanString: function(dirtyString) {
		var result = dirtyString;
		result = result.replace("|", "");
		result = result.replace("*", "");

		return result;
	}
}