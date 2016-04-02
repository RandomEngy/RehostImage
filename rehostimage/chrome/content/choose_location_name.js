function onWindowLoad() {
	document.title = window.arguments[1];

	document.getElementById("newlocationname").value = window.arguments[2];
	document.getElementById("newlocationname").select();
}

function onAccept() {
	var riBundle = document.getElementById("us.engy.rehostImage.bundle");
	var newName = document.getElementById("newlocationname").value;
	
	if (newName == "") {
		alert(riBundle.getString("error.blanklocationname"));
		return false;
	}
	
	newName = newName.replace("|", "");
	newName = newName.replace("*", "");
	newName = newName.replace('"', "");
	
	window.arguments[0].name = newName;
	
	return true;
}