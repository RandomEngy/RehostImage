var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
var Cc = Components.classes;
var Ci = Components.interfaces;

var uploadLocations = new Array();
var currentLocationIndex;

function onLoad() {
	Components.utils.import("resource://rehostimage/database.jsm");
	Components.utils.import("resource://rehostimage/configuration_helper.jsm");
	
	uploadLocations = configurationHelper.getLocations();
	
	var windowArguments = null;
	if (window.arguments != null && window.arguments[0] != null) {
		windowArguments = window.arguments[0];
	}
	
	if (windowArguments != null && windowArguments.startPane != null) {
		document.documentElement.showPane(document.documentElement.preferencePanes[windowArguments.startPane]);
	}

	var numLocations = uploadLocations.length;
	
	var preferences = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.rehostimage.");

	var startLocationIndex = preferences.getIntPref("lastlocationindex");
	
	for (var i = 0; i < uploadLocations.length; i++) {
		var locationName = uploadLocations[i].name;
		document.getElementById("locationsList").appendItem(locationName);

		if (windowArguments != null && windowArguments.startLocationName == locationName) {
			startLocationIndex = i;
		}
	}
	
	if (startLocationIndex < 0 || startLocationIndex >= uploadLocations.length) {
		startLocationIndex = 0;
	}

	if (numLocations > 0) {
		document.getElementById("locationsList").selectedIndex = startLocationIndex;
	}
	
	if (!document.getElementById("resizeImageOption").checked) {
		disableResizeOptions();
	}
	
	document.getElementById("locationTabs").selectedIndex = preferences.getIntPref("lastlocationtabindex");
	
	refreshHistory();
	refreshDeleteEnable();
}

function onAccept() {
	try {
		writeDataToStructure();
	
		configurationHelper.setLocations(uploadLocations);
		
		if (window.arguments != null && window.arguments[0] != null) {
			window.arguments[0].out = true;
		}
	} catch (exception) {
		alert(exception);
		throw exception;
	}

	return true;
}

function onClose() {
	var browserPreferences = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("browser.preferences.");
	if (browserPreferences.getBoolPref("instantApply")) {
		writeDataToStructure();
		configurationHelper.setLocations(uploadLocations);
	}
	
	var preferences = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.rehostimage.");
	preferences.setIntPref("lastlocationindex", document.getElementById("locationsList").selectedIndex);
	preferences.setIntPref("lastlocationtabindex", document.getElementById("locationTabs").selectedIndex);
}

function onLocationSelected() {
	var locationsList = document.getElementById("locationsList");
	var selectedLocationIndex = locationsList.selectedIndex;
	var selectedLocation = uploadLocations[selectedLocationIndex];
	
	if (currentLocationIndex >= 0) {
		writeDataToStructure();
	}
	
	var selectedType = selectedLocation.type;
	var targetTypeList = document.getElementById("targetTypeList");
	
	document.getElementById("showRenameOption").checked = selectedLocation.showRenameOption;
	document.getElementById("shortenUrl").checked = selectedLocation.shortenUrl;
	document.getElementById("resizeImageOption").checked = selectedLocation.resizeEnable;
	document.getElementById("resizeWidth").value = selectedLocation.resizeWidth;
	document.getElementById("resizeHeight").value = selectedLocation.resizeHeight;
	document.getElementById("resizeImageFormat").value = selectedLocation.resizeFormat;
	document.getElementById("resizeImageQualityScale").value = selectedLocation.resizeQuality;
	
	switch (selectedType) {
		case "imgur":
			targetTypeList.selectedIndex = 0;
			break;
		case "imageshack":
			targetTypeList.selectedIndex = 1;

			document.getElementById("imageshackUsername").value = selectedLocation.userName != null ? selectedLocation.userName : "";
			document.getElementById("imageshackPassword").value = selectedLocation.password != null ? selectedLocation.password : "";

			break;
		case "ftp":
			targetTypeList.selectedIndex = 2;
			
			document.getElementById("host").value = selectedLocation.host;
			document.getElementById("username").value = selectedLocation.userName;
			document.getElementById("password").value = selectedLocation.password != null ? selectedLocation.password : "";
			document.getElementById("remotedirectory").value = selectedLocation.remoteDirectory;
			document.getElementById("webfolder").value = selectedLocation.webFolder;
			break;
		default:
			break;
	}
	
	// Make sure UI in settings tab is in correct state
	refreshSettingsTab();
	
	currentLocationIndex = selectedLocationIndex;
}

// Sets visibility for the selected pane and populates control with defaults.
function onTargetTypeSelected() {
	var newTargetType = document.getElementById("targetTypeList").value;
	collapseAllPanes();
	
	if (newTargetType == "ftp") {
		document.getElementById("ftpPane").collapsed = false;
		
		document.getElementById("host").value = "";
		document.getElementById("username").value = "";
		document.getElementById("password").value = "";
		document.getElementById("remotedirectory").value = "";
		document.getElementById("webfolder").value = "http://";
	} else if (newTargetType == "imageshack") {
		document.getElementById("imageshackPane").collapsed = false;

		document.getElementById("imageshackUsername").value = "";
		document.getElementById("imageshackPassword").value = "";
	} else {
		document.getElementById("imgurPane").collapsed = false;
		
		onImgurSelect();
	}
}

function onImageQualityChanged() {
	document.getElementById("resizeImageQualityText").value = document.getElementById("resizeImageQualityScale").value;
}

function onImgurSelect() {
	Components.utils.import("resource://rehostimage/imgur3.jsm");
	Imgur3RI.initialize();
	
	imgurUpdateStatus();
}

function imgurUpdateStatus() {
	var riBundle = document.getElementById("us.engy.rehostImage.bundle");
	
	if (Imgur3RI.authenticated) {
		document.getElementById("imgurAnonPane").collapsed = true;
		document.getElementById("imgurSignedInPane").collapsed = false;
		
		var signedInDescription = document.getElementById("imgurSignedInDescription");
		var signedInString = riBundle.getString("label.imgur.signedinas");
		signedInDescription.collapsed = false;
		signedInDescription.value = signedInString.replace("{0}", Imgur3RI.userName);

		imgurSetLoading(false);
	} else {
		document.getElementById("imgurAnonPane").collapsed = false;
		document.getElementById("imgurSignedInPane").collapsed = true;
	}
}

function imgurSignIn() {
	var riBundle = document.getElementById("us.engy.rehostImage.bundle");
	imgurSetLoading(true);
	document.getElementById("imgurAnonPane").collapsed = true;

	var pin = document.getElementById("imgurPinTextBox").value;

	Imgur3RI.signIn(pin, function () {
		imgurUpdateStatus();
		imgurSetLoading(false);
	}, function (request) {
		// Do we need to do more on error?
		data = JSON.parse(request.responseText);

		if (data && data.data && data.data.error) {
			alert(data.data.error);
		}

		imgurUpdateStatus();
		imgurSetLoading(false);
	});
}

function imgurGetPin() {
	var width = 630;
	var height = 570;
	var left = screen.width / 2 - width / 2;
	var top = screen.height / 2 - height / 2;

	window.openDialog("https://api.imgur.com/oauth2/authorize?client_id=eb54db8a1758048&response_type=pin", "testWindow", "width=630,height=570,left=" + left + ",top=" + top + ",resizable=yes,chrome=no,modal=no");
}

function imgurLogOut() {
	Imgur3RI.signOut();
	imgurUpdateStatus();

	document.getElementById("imgurPinTextBox").value = "";
}

function imgurSetLoading(loading) {
	document.getElementById("imgurLoadGif").collapsed = !loading;
}

function collapseAllPanes() {
	document.getElementById("ftpPane").collapsed = true;
	document.getElementById("imageshackPane").collapsed = true;
	document.getElementById("imgurPane").collapsed = true;
}

function addNewLocation() {
	var riBundle = document.getElementById("us.engy.rehostImage.bundle");
	var locationNameResult = { name: null };
	
	window.openDialog(
		"chrome://rehostimage/content/choose_location_name.xul",
		null,
		"chrome,modal,dependent=yes,centerscreen=yes",
		locationNameResult,
		riBundle.getString("title.newlocationname"),
		"");
	
	if (locationNameResult.name != null) {
		var newLocationName = locationNameResult.name;
		var hasDuplicate = false;
		
		for (var i = 0; i < uploadLocations.length; i++) {
			if (newLocationName == uploadLocations[i].name) {
				hasDuplicate = true;
				break;
			}
		}
		
		if (hasDuplicate) {
			alert(riBundle.getString("error.duplicatelocationname"));
		} else {
			var newLocation = new Object();
		
			newLocation.name = newLocationName;
			newLocation.type = "imgur";
			
			configurationHelper.applyDefaults(newLocation);
			
			uploadLocations.push(newLocation);
		
			var locationsList = document.getElementById("locationsList");
		
			locationsList.appendItem(newLocationName);
			locationsList.selectedIndex = locationsList.itemCount - 1;
			
			refreshDeleteEnable();
		}
	}
}

function deleteLocation() {
	var locationsList = document.getElementById("locationsList");
	var currentIndex = locationsList.selectedIndex;
	var newIndex;
	
	if (currentIndex == locationsList.itemCount - 1) {
		newIndex = currentIndex - 1;
	} else {
		newIndex = currentIndex;
	}
	
	uploadLocations.splice(currentIndex, 1);
	locationsList.removeItemAt(currentIndex);
	
	locationsList.selectedIndex = newIndex;
	currentLocationIndex = newIndex;
	
	refreshDeleteEnable();
}

function renameLocation() {
	var riBundle = document.getElementById("us.engy.rehostImage.bundle");
	
	var locationsList = document.getElementById("locationsList");
	
	var locationNameResult = { name: null };

	window.openDialog(
		"chrome://rehostimage/content/choose_location_name.xul",
		null,
		"chrome,modal,dependent=yes,centerscreen=yes",
		locationNameResult,
		riBundle.getString("title.renamelocationname"),
		uploadLocations[currentLocationIndex].name);
	
	var newLocationName = locationNameResult.name;
	var hasDuplicate = false;
	
	for (var i = 0; i < uploadLocations.length; i++) {
		if (i != currentLocationIndex && newLocationName == uploadLocations[i].name) {
			hasDuplicate = true;
			break;
		}
	}
	
	if (hasDuplicate) {
		alert(riBundle.getString("error.duplicatelocationname"));
	} else {
		uploadLocations[currentLocationIndex].name = newLocationName;
		locationsList.currentItem.label = newLocationName;
	}
}

function writeDataToStructure() {
	var uploadType = document.getElementById("targetTypeList").value;
	
	var currentLocation = uploadLocations[currentLocationIndex];
	
	currentLocation.type = uploadType;
	
	currentLocation.showRenameOption = document.getElementById("showRenameOption").checked;
	currentLocation.shortenUrl = document.getElementById("shortenUrl").checked;
	currentLocation.resizeEnable = document.getElementById("resizeImageOption").checked;
	currentLocation.resizeWidth = document.getElementById("resizeWidth").value;
	currentLocation.resizeHeight = document.getElementById("resizeHeight").value;
	currentLocation.resizeFormat = document.getElementById("resizeImageFormat").value;
	currentLocation.resizeQuality = document.getElementById("resizeImageQualityScale").value;
	
	if (uploadType == "ftp") {
		var hostString = document.getElementById("host").value;
		hostString = hostString.toLowerCase();
		
		if (hostString.substring(0, 6) == "ftp://" && hostString.length > 6) {
			hostString = hostString.substring(6);
		}
		
		currentLocation.host = hostString;
		currentLocation.userName = document.getElementById("username").value;
		currentLocation.password = document.getElementById("password").value;
		currentLocation.remoteDirectory = document.getElementById("remotedirectory").value;
		currentLocation.webFolder = document.getElementById("webfolder").value;
	} else if (uploadType == "imageshack") {
		currentLocation.userName = document.getElementById("imageshackUsername").value;
		currentLocation.password = document.getElementById("imageshackPassword").value;
	}
}

function refreshDeleteEnable() {
	var deleteButton = document.getElementById("deletelocationbutton");
	if (uploadLocations.length <= 1) {
		deleteButton.disabled = true;
	} else {
		deleteButton.disabled = false;
	}
}

function refreshHistory() {
	var dbConnection = database.getDBConnection();
	
	var getHistoryStatement = dbConnection.createStatement("SELECT destinationUrl FROM uploadHistory ORDER BY id DESC");
	
	var historyEntries = new Array();
	
	getHistoryStatement.executeAsync({
		handleResult: function(aResultSet){
			for (var row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
				historyEntries.push(row.getResultByName("destinationUrl"));
			}
		},
		
		handleError: function(aError){
		},
		
		handleCompletion: function(aReason){
			var newHistoryString = "";
			for (var i = 0; i < historyEntries.length; i++) {
				newHistoryString += historyEntries[i] + "\n";
			}
			
			document.getElementById("historyText").value = newHistoryString;
		}
	});
}

function clearHistory() {
	var dbConnection = database.getDBConnection();
	
	dbConnection.executeSimpleSQL("DELETE FROM uploadHistory");
	document.getElementById("historyText").value = "";
}

function loadUrl(url) {
	var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var mainWindow = windowMediator.getMostRecentWindow("navigator:browser");
	mainWindow.gBrowser.addTab(url);
}

function onResizeImageOptionChanged() {
	// For some reason this reads as the old checked value
	var wasChecked = document.getElementById("resizeImageOption").checked;
	
	if (wasChecked) {
		// No longer checked, disable the sub-options.
		disableResizeOptions();
	} else {
		// Now checked, enable the sub-options.
		enableResizeOptions();
	}
}

function refreshSettingsTab() {
	if (document.getElementById("resizeImageOption").checked) {
		enableResizeOptions();
	} else {
		disableResizeOptions();
	}
	
	onImageQualityChanged();
}

function enableResizeOptions() {
	setDisabledOnResizeElements(false);
	
	// Disable the JPG quality slider if it's not selected.
	onResizeFormatOptionChanged();
}

function disableResizeOptions() {
	setDisabledOnResizeElements(true);
}

function setDisabledOnResizeElements(newDisabledValue) {
	document.getElementById("resizeWidthLabel").disabled = newDisabledValue;
	document.getElementById("resizeWidth").disabled = newDisabledValue;
	document.getElementById("resizeWidthPixelsLabel").disabled = newDisabledValue;
	document.getElementById("resizeHeightLabel").disabled = newDisabledValue;
	document.getElementById("resizeHeight").disabled = newDisabledValue;
	document.getElementById("resizeHeightPixelsLabel").disabled = newDisabledValue;
	document.getElementById("resizeImageFormatLabel").disabled = newDisabledValue;
	document.getElementById("resizeImageFormat").disabled = newDisabledValue;
	document.getElementById("resizeImageQualityLabel").disabled = newDisabledValue;
	document.getElementById("resizeImageQualityText").disabled = newDisabledValue;
	document.getElementById("resizeImageQualityScale").disabled = newDisabledValue;
}

function onResizeFormatOptionChanged() {
	var newFormat = document.getElementById("resizeImageFormat").value;
	
	if (newFormat == "JPG") {
		document.getElementById("resizeImageQualityLabel").disabled = false;
		document.getElementById("resizeImageQualityText").disabled = false;
		document.getElementById("resizeImageQualityScale").disabled = false;
	} else {
		document.getElementById("resizeImageQualityLabel").disabled = true;
		document.getElementById("resizeImageQualityText").disabled = true;
		document.getElementById("resizeImageQualityScale").disabled = true;
	}
}
