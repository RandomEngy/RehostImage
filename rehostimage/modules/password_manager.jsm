var EXPORTED_SYMBOLS = ["passwordManager"];

var Cc = Components.classes;
var Ci = Components.interfaces;

passwordManager = {
	passwordUri: "chrome://rehostimage/",

	populatePasswords: function(locations) {
		if (!this.locationsIncludePassword(locations)) {
			return;
		}
		
		// Use FF 3 password manager
		var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
		var logins = loginManager.findLogins({}, this.passwordUri, "FTP Login", null);

		for (var i = 0; i < logins.length; i++) {
			var location = this.getLocation(locations, logins[i].username);
			if (location != null) {
				// Blank passwords are stored as a single space.
				var savedPassword = "";
				if (logins[i].password != " ") {
					savedPassword = logins[i].password;
				}
				location.password = savedPassword;
			}
		}
	},

	setPasswords: function(locations) {
		if (!this.locationsIncludePassword(locations)) {
			return;
		}
		
		var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
		var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
		
		var logins = loginManager.findLogins({}, this.passwordUri, "FTP Login", null);
		
		var i;
		
		// Remove the previous login info, if it exists.
		for (i = 0; i < logins.length; i++) {
			loginManager.removeLogin(logins[i]);
		}
		
		var location;

		for (i = 0; i < locations.length; i++) {
			location = locations[i];
			if (location.type === "ftp" || location.type === "imageshack" && !location.anonymous) {
				// Blank passwords are stored as a single space.
				var passwordToSave = " ";
				if (location.password != null && location.password != "") {
					passwordToSave = location.password;
				}
				
				var loginInfo = new nsLoginInfo(this.passwordUri, "FTP Login", null, location.name, passwordToSave, "", "");
				loginManager.addLogin(loginInfo);
			}
		}
	},

	locationsIncludePassword: function(locations) {
		var location;
		for (i = 0; i < locations.length; i++) {
			location = locations[i];
			if (location.type === "ftp" || location.type === "imageshack" && !location.anonymous) {
				return true;
			}
		}
		
		return false;
	},
	
	getLocation: function(locations, locationName) {
		for (var i = 0; i < locations.length; i++) {
			if (locationName == locations[i].name) {
				return locations[i];
			}
		}
		
		return null;
	},
	
	getOldPassword: function() {
		var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
		var logins = loginManager.findLogins({}, this.passwordUri, "FTP Login", null);

		var password = "";

		// The old version stored only one password, so just use the first match.
		if (logins.length > 0) {
			password = logins[0].password;
		}

		return password;
	}
}