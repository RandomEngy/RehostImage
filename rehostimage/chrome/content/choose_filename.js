function onLoad() {
    var suggestedName = window.arguments[0].suggestedName;
    var fileNameBox = document.getElementById("newfilename");
    fileNameBox.value = suggestedName;

    var dotIndex = suggestedName.lastIndexOf(".");
    if (dotIndex != -1) {
        fileNameBox.focus();
        fileNameBox.setSelectionRange(0, dotIndex);
    }
}

function onAccept() {
    var riBundle = document.getElementById("us.engy.rehostImage.bundle");
    var newName = document.getElementById("newfilename").value;

    if (newName == "") {
        alert(riBundle.getString("error.blankfilename"));
        return false;
    }

    var disallowedcharacters = ["\\", "/", ":", "?", "\"", "<", ">", "|", "&"];

    for (var i = 0; i < disallowedcharacters.length; i++) {
        newName = newName.replace(disallowedcharacters[i], "_");
    }

    window.arguments[0].fileName = newName;

    return true;
}