var EXPORTED_SYMBOLS = ["database"];

Components.utils.import("resource://rehostimage/strings.jsm");

var Cc = Components.classes;
var Ci = Components.interfaces;

var database = {
	dbConnection: null,
	
	getDBConnection: function() {
		var dbFile = Components.classes["@mozilla.org/file/directory_service;1"]  
			.getService(Ci.nsIProperties)  
			.get("ProfD", Ci.nsIFile);  
		dbFile.append("extensions.rehostimage.sqlite");  
		
		var fileExisted = dbFile.exists();
		
		var storageService = Cc["@mozilla.org/storage/service;1"]  
		                     .getService(Ci.mozIStorageService);  
		this.dbConnection = storageService.openDatabase(dbFile);
		
		if (!fileExisted) {
			// Build the database from scratch
			this.dbConnection.beginTransaction();
			this.dbConnection.executeSimpleSQL("CREATE TABLE uploadHistory (id INTEGER PRIMARY KEY AUTOINCREMENT, sourceUrl TEXT, destinationUrl TEXT, uploadedTime TEXT)");
			this.createLocationsTable();
			this.addDefaultLocation();
			
			this.dbConnection.commitTransaction();
		} else if (!this.dbConnection.tableExists("locations")) {
			// Just need to add the locations and version table
			this.dbConnection.beginTransaction();
			this.createLocationsTable();
			this.addDefaultLocation();
			this.dbConnection.commitTransaction();
		}
		
		// We add the default location to make sure it's there. If we have old locations those will overwrite the default.
		
		return this.dbConnection;
	},
	
	createLocationsTable: function() {
		this.dbConnection.executeSimpleSQL("CREATE TABLE locations (" +
			"name TEXT NOT NULL, " +
			"type TEXT NOT NULL, " +
			"imageshackAnonymous BOOL, " +
			"imageshackRegistrationCode TEXT, " +
			"imageshackIncludeResolutionBar BOOL, " +
			"host TEXT, " +
			"userName TEXT, " +
			"remoteDirectory TEXT, " +
			"webFolder TEXT, " +
			"showRenameOption BOOL, " +
			"shortenUrl BOOL, " +
			"resizeEnable BOOL, " +
			"resizeWidth INTEGER, " +
			"resizeHeight INTEGER, " +
			"resizeFormat TEXT, " +
			"resizeQuality INTEGER)");
		this.dbConnection.executeSimpleSQL("CREATE TABLE version (version INTEGER)");
		this.dbConnection.executeSimpleSQL("INSERT INTO version (version) VALUES (1)");
	},
	
	addDefaultLocation: function() {
		this.dbConnection.executeSimpleSQL("INSERT INTO locations (name, type, showRenameOption, shortenUrl, resizeEnable, resizeWidth, resizeHeight, resizeFormat, resizeQuality) " +
			"VALUES ('" + strings.getString("label.defaultlocationname") + "', 'imgur', 0, 0, 0, 800, 600, 'JPG', 80)");
	},
	
	getDBVersion: function() {
		var getVersion = dbConnection.createStatement("SELECT version FROM version");
		if (getVersion.executeStep()) {
			return getVersion.getInt32(0);
		}
		
		return null;
	}
}
