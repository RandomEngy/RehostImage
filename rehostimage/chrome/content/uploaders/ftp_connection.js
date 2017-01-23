if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

us.engy.rehostImage.ftpConnection = function(host, username, password, uploadDirectory, sourceFile, destinationFilename) {
    this.transportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
    this.utf8Converter = Cc["@mozilla.org/intl/utf8converterservice;1"].getService(Ci.nsIUTF8ConverterService);
    this.unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].getService(Ci.nsIScriptableUnicodeConverter);

    this.consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

    this.host = host;
    this.port = 21;

    var colonIndex = host.indexOf(":");
    if (colonIndex > 0) {
        this.host = this.host.substring(0, colonIndex);
    
        if (colonIndex < host.length - 1) {
            this.port = parseInt(host.substring(colonIndex + 1));
        }
    }
    
    this.username = username;
    this.password = password;
    this.uploadDirectory = uploadDirectory;

    if (this.uploadDirectory == "") {
        this.uploadDirectory = "/";
    } else if (this.uploadDirectory[0] != "/") {
        this.uploadDirectory = "/" + this.uploadDirectory;
    }

    if (this.uploadDirectory.length > 1 && this.uploadDirectory[this.uploadDirectory.length - 1] == "/") {
        this.uploadDirectory = this.uploadDirectory.substring(0, this.uploadDirectory.length - 1);
    }
    
    this.sourceFile = sourceFile;
    this.destinationFilename = destinationFilename;
}

us.engy.rehostImage.ftpConnection.prototype = {
    controlTransport: null,
    controlInstream: null,
    controlOutstream: null,

    dataStream: null,
	
	reportedSuccess: false,

    state: "start",

    executeTransfer: function() {
        var self = this;

        this.controlTransport = this.transportService.createTransport(null, 0, this.host, this.port, null);
        this.controlOutstream = this.controlTransport.openOutputStream(0, 0, 0);
        var controlStream = this.controlTransport.openInputStream(0, 0, 0);
        this.controlInstream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
        this.controlInstream.init(controlStream);

        var dataListener = {
            data: "",

            onStartRequest: function(request, context) { },

            onStopRequest: function(request, context, status) {
                self.closeConnection();

                var riBundle = document.getElementById("us.engy.rehostImage.bundle");

                if (status != Components.results.NS_OK) {
                    us.engy.rehostImage.main.reportCompletion(false, riBundle.getString("error.disconnected"));
                }
            },

            onDataAvailable: function(request, context, inputStream, offset, count) {
                this.data = self.controlInstream.read(count);

                self.handleServerResponse(this.data);
            }
        };

        var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
        pump.init(controlStream, -1, -1, 0, 0, false);
        pump.asyncRead(dataListener, null);
    },

    sendCommand: function(command) {
        this.logFtpMessage("Command: " + command);

        var outputCommand = command + "\r\n";

        this.controlOutstream.write(outputCommand, outputCommand.length);
    },

    handleServerResponse: function(response) {
        this.logFtpMessage("Response: " + response);

        var riBundle = document.getElementById("us.engy.rehostImage.bundle");
		
		var responseLines = response.split("\r\n");
		
		if (responseLines.length < 2) {
			this.exitWithError(riBundle.getString("error.badftpresponse"), response);
			return;
		}
		
		var validChars = "0123456789";
		
		for (i = 0; i < responseLines.length - 1; i++) {
			if (responseLines[i].length >= 3) {
				var isValidLine = true;
				for (j = 0; j < 3; j++) {
					if (validChars.indexOf(responseLines[i].charAt(j)) == -1) {
						isValidLine = false;
					}
				}
				
				if (isValidLine) {
					this.handleFtpCommand(responseLines[i]);
				}
			}
		}
    },
	
	handleFtpCommand: function(response) {
		var riBundle = document.getElementById("us.engy.rehostImage.bundle");
		
		var majorCode = response.substring(0, 1);
		var fullCode = response.substring(0, 3);

        switch (this.state) {
            case "start":
                if (fullCode == "220") {
                    this.state = "username";
                    this.sendCommand("USER " + this.username);
                } else {
                    this.exitWithError(riBundle.getString("error.connectionfailure") + " " + this.host + (this.port == 21 ? "" : (":" + this.port)), response);
                }
                break;
            case "username":
                if (fullCode == "331") {
                    this.state = "password";
                    this.sendCommand("PASS " + this.password);
                } else if (fullCode == "220") {
					// Do nothing on extra welcome messages
				} else {
                    this.exitWithError(riBundle.getString("error.invalidlogin"), response);
                }
                break;
            case "password":
                if (fullCode == "230") {
                    this.state = "changedir";
                    this.sendCommand("CWD " + this.uploadDirectory);
                } else {
                    this.exitWithError(riBundle.getString("error.invalidlogin"), response);
                }
                break;
            case "changedir":
                if (fullCode == "250") {
                    this.state = "getlistpasv";
                    this.sendCommand("PASV");
                } else if (majorCode == "2") {
					// Do nothing on extra success messages
				} else {
                    this.exitWithError(riBundle.getString("error.missingdirectory"), response);
                }
                break;
            case "getlistpasv":
                if (fullCode == "227") {
                    this.state = "gettinglist";

                    this.dataStream = new us.engy.rehostImage.ftpDatastream(this.host, this.getPortFromPasvResponse(response));
                    this.dataStream.connectRead();

                    this.sendCommand("LIST");
				} else if (majorCode == "2") {
					// Do nothing on extra success messages
                } else {
                    this.exitWithError(riBundle.getString("error.pasvlistrejected"), response);
                }
                break;
            case "gettinglist":
                if (fullCode == "226") {
					if (this.dataStream.finished) {
						this.onDataStreamFinish();
					} else {
						this.dataStream.connection = this;
					}
                } else if (majorCode == "1") {
                    // do nothing
                } else {
                    this.exitWithError(riBundle.getString("error.listfailed"), response);
                }
                break;
            case "switchtobinary":
                if (fullCode == "200") {
                    this.state = "uploadfilepasv";
                    this.sendCommand("PASV");
                } else if (majorCode == "2") {
					// Do nothing on extra success messages
				} else {
                    this.exitWithError(riBundle.getString("error.binaryfailed"), response);
                }
                break;
            case "uploadfilepasv":
                if (fullCode == "227") {
                    this.state = "uploadingfile";

                    this.dataStream = new us.engy.rehostImage.ftpDatastream(this.host, this.getPortFromPasvResponse(response), this.sourceFile);
                    this.dataStream.connectWrite();

                    this.sendCommand("STOR " + this.destinationFilename);
                } else if (majorCode == "2") {
					// Do nothing on extra success messages
				} else {
                    this.exitWithError(riBundle.getString("error.pasvstorrejected"), response);
                }
                break;
            case "uploadingfile":
                if (fullCode == "226") {
                    this.closeConnection();
                    this.reportSuccess();
                } else if (majorCode == "1") {
                    // do nothing;
                } else {
                    this.exitWithError(riBundle.getString("error.uploadfailed"), response);
                }
                break;
            default:
                break;
        }
	},
	
	onDataStreamFinish: function() {
		// If the file already exists, we must make a new one.
		if (this.dataStream.listData.toLowerCase().indexOf(this.destinationFilename.toLowerCase()) >= 0) {
			this.destinationFilename = us.engy.rehostImage.main.findNewFilename(this.destinationFilename, this.dataStream.listData);
		}
		
		this.state = "switchtobinary";
		this.sendCommand("TYPE I");
	},

    getPortFromPasvResponse: function(pasvResponse) {
        var pasvAddress = pasvResponse.substring(pasvResponse.indexOf("(") + 1, pasvResponse.indexOf(")"));
        var addressParts = pasvAddress.split(",");
        return parseInt(addressParts[4]) * 256 + parseInt(addressParts[5]);
    },

    exitWithError: function(friendlyMessage, response) {
        this.closeConnection();

        var riBundle = document.getElementById("us.engy.rehostImage.bundle");

        var errorMessage = riBundle.getString("error.transferfailed") + "\n";
        errorMessage += friendlyMessage;

        if (response) {
            errorMessage += "\n\n" + riBundle.getString("error.serverresponse") + "\n" + response;
        }

        us.engy.rehostImage.main.reportCompletion(false, errorMessage);
    },

	reportSuccess: function() {
		if (!this.reportedSuccess) {
			us.engy.rehostImage.main.reportUploadSuccess();
			this.reportedSuccess = true;
		}
	},

    closeConnection: function() {
        if (this.controlInstream) {
            this.controlInstream.close();
        }

        if (this.controlOutstream) {
            this.controlOutstream.close();
        }

        if (this.controlTransport) {
            this.controlTransport.close("Finished");
        }

        if (this.dataStream) {
            this.dataStream.kill();
            this.dataStream = null;
        }
    },

    logFtpMessage: function(message) {
        var preferences = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.rehostimage.");
        if (preferences.getBoolPref("logftpcommands")) {
            if (message.length >= 13 && message.substring(0, 13) == "Command: PASS") {
                message = "Command: PASS ******";
            }

            this.consoleService.logStringMessage(message);
        }
    }
}