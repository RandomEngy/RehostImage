if (!us) var us = {};
if (!us.engy) us.engy = {};
if (!us.engy.rehostImage) us.engy.rehostImage = {};

us.engy.rehostImage.ftpDatastream = function(host, port, sourceFile) {
    this.host = host;
    this.port = port;
    this.sourceFile = sourceFile;
    
    this.transportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
    this.eventTarget = Cc["@mozilla.org/thread-manager;1"].getService().currentThread;
    this.dataListener = new us.engy.rehostImage.dataListener();
    this.progressEventSink = new us.engy.rehostImage.progressEventSink();
}

us.engy.rehostImage.ftpDatastream.prototype = {
    dataTransport: null,
    dataInstream: null,
    dataOutstream: null,
    uploadInputStream: null,

    tempFile: null,

    listData: "",
    finished: false,
	connection: null,

    connectWrite: function() {
        var fileSize2 = this.sourceFile.fileSize;
		
        var fileInputStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
		fileInputStream.init(this.sourceFile, -1, 0, 0);

        this.uploadInputStream = fileInputStream;

        this.continueConnectWrite(fileSize2);
    },

    continueConnectWrite: function(fileSize) {
        this.dataTransport = this.transportService.createTransport(null, 0, this.host, this.port, null);

        this.dataOutstream = this.dataTransport.openOutputStream(0, 0, -1);

        var binaryOutstream = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);
        binaryOutstream.setOutputStream(this.dataOutstream);

        this.dataInstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
        this.dataInstream.setInputStream(this.uploadInputStream);

        this.progressEventSink.parent = this;
        this.progressEventSink.dataInstream = this.dataInstream;
        this.progressEventSink.dataOutstream = binaryOutstream;
        this.progressEventSink.bytesTotal = fileSize;

        this.dataTransport.setEventSink(this.progressEventSink, this.eventTarget);

        var dataBuffer = this.dataInstream.readBytes(this.dataInstream.available() < 4096 ? this.dataInstream.available() : 4096);
        this.progressEventSink.dataOutstream.writeBytes(dataBuffer, dataBuffer.length);
    },

    connectRead: function() {
        this.dataTransport = this.transportService.createTransport(null, 0, this.host, this.port, null);

        var dataStream = this.dataTransport.openInputStream(0, 0, 0);
        this.dataInstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
        this.dataInstream.setInputStream(dataStream);

        this.dataListener.parent = this;
        this.dataListener.dataInstream = this.dataInstream;

        var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
        pump.init(dataStream, -1, -1, 0, 0, false);
        pump.asyncRead(this.dataListener, null);
    },
	
    kill: function() {
        if (this.dataInstream) {
            this.dataInstream.close();
        }

        if (this.dataOutstream) {
            this.dataOutstream.flush();
            this.dataOutstream.close();
        }

        if (this.uploadInputStream) {
            this.uploadInputStream.close();
        }

        if (this.dataTransport) {
            this.dataTransport.close("Finished");
        }

        this.dataListener.parent = null;
        this.progressEventSink.parent = null;
        this.finished = true;
		
		if (this.connection != null) {
			this.connection.onDataStreamFinish();
		}
		
		this.connection = null;
    }
}

us.engy.rehostImage.dataListener = function () { }

us.engy.rehostImage.dataListener.prototype = {
    parent: null,
    dataInstream: null,
    data: "",

    onStartRequest: function(request, context) {
    },

    onStopRequest: function(request, context, status) {
        if (this.parent) {
            this.parent.listData = this.data;
            this.parent.kill();
        }
    },

    onDataAvailable: function(request, context, inputStream, offset, count) {
        this.data += this.dataInstream.readBytes(count);
    }
}

us.engy.rehostImage.progressEventSink = function() { }

us.engy.rehostImage.progressEventSink.prototype = {
    parent: null,

    dataInstream: null,
    dataOutstream: null,

    bytesTotal: 0,

    onTransportStatus: function(transport, status, progress, progressMax) {
        if (progress == this.bytesTotal) {  // finished writing
            this.parent.kill();
            return;
        }

        us.engy.rehostImage.main.reportProgress((progress * 100) / this.bytesTotal);

        var dataBuffer = this.dataInstream.readBytes(this.dataInstream.available() < 4096 ? this.dataInstream.available() : 4096);
        this.dataOutstream.writeBytes(dataBuffer, dataBuffer.length);
    }
}