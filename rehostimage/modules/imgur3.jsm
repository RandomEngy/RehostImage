var EXPORTED_SYMBOLS = ["Imgur3RI"];

var windowManager =
  Components
    .classes['@mozilla.org/appshell/window-mediator;1']
    .getService(Components.interfaces.nsIWindowMediator);

var passwordManager =
  Components
    .classes["@mozilla.org/login-manager;1"]
    .getService(Components.interfaces.nsILoginManager);
              
var nsLoginInfo =
  new Components.Constructor(
    "@mozilla.org/login-manager/loginInfo;1",
    Components.interfaces.nsILoginInfo, "init");

var loginHostName = "chrome://rehostimage";
var loginRealm = "Imgur 3 Realm";

var clientId = "eb54db8a1758048";
var clientSecret = "acc2a9c4637fe649071994882825d8809bbee0a8";

var Imgur3RI = {
  authenticated: false,
  
  // User name and refresh token only set when authenticated === true
  userName: null,
  _refreshToken: null,
  
  _accessToken: null,
  _accessTokenValidUntil: null,
  
  _initialized: false,
  
  signIn: function(pin, success, errorHandler) {
    var that = this;
    
    var message = {
      method: "POST",
      action: "https://api.imgur.com/oauth2/token",
      parameters: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "pin",
        pin: pin.trim()
      }
    }
    
    this._request(
      message,
      null,
      function(request) {
        data = JSON.parse(request.responseText);
        that.userName = data.account_username;
        that._refreshToken = data.refresh_token;
        that._saveAccountInfo(that.userName, that._refreshToken);
        
        that._updateAccessToken(data);
        that.authenticated = true;
        
        success();
      },
      errorHandler);
  },
  
  signOut: function() {
    this.authenticated = false;
    this._refreshToken = null;
    this._accessToken = null;
    
    this._clearAccountInfo();
  },
  
  upload: function(base64data, progress, success, errorHandler) {
    var that = this;
    
    this.initialize();
    
    if (!this.authenticated || this._accessTokenIsValid()) {
      this._doUpload(base64data, progress, success, errorHandler);
      return;
    }
    
    var message = {
      method: "POST",
      action: "https://api.imgur.com/oauth2/token",
      parameters: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: this._refreshToken
      }
    }
    
    this._request(
      message,
      null,
      function(request) {
        data = JSON.parse(request.responseText);
        that._updateAccessToken(data);
        
        that._doUpload(base64data, progress, success, errorHandler);
      },
      errorHandler);
  },
  
  // Performs the upload with the current access token. Make sure it's up to date before calling
  _doUpload: function(base64data, progress, success, errorHandler) {
    var useAccessToken = this.authenticated && this._accessTokenIsValid();
    
    var message = {
      method: "POST",
      action: "https://api.imgur.com/3/image",
      useAccessToken: useAccessToken,
      parameters: {
        image: base64data,
        type: "base64"
      }
    };

    this._request(
      message,
      progress,
      function(request) {
        data = JSON.parse(request.responseText);
        
        // Change to HTTPS link
        var imageLink = data.data.link;
        if (imageLink.substring(0, 7) === "http://") {
          imageLink = "https://" + imageLink.substring(7, imageLink.length);
        }
        
        success(imageLink);
      },
      errorHandler
    );
  },
  
  initialize: function() {
    if (this._initialized) {
      return;
    }
    
    var accountInfo = this._getAccountInfo();
    if (accountInfo) {
      this.authenticated = true;
      this.userName = accountInfo.username;
      this._refreshToken = accountInfo.password;
    } else {
      this.authenticated = false;
    }
  },
  
  // Gets user account name and refresh token if available
  _getAccountInfo: function() {
    var logins = passwordManager.findLogins({}, loginHostName, null, loginRealm);
    return logins[0];
  },
  
  _saveAccountInfo: function (userName, refreshToken) {
    this._clearAccountInfo();
  
    loginInfo = new nsLoginInfo(
      loginHostName,
      null,
      loginRealm,
      userName,
      refreshToken,
      "",
      "");
    passwordManager.addLogin(loginInfo);
  },
  
  _clearAccountInfo: function() {
    var loginInfo = this._getAccountInfo();
    if (loginInfo) {
      passwordManager.removeLogin(loginInfo);
    }
  },
  
  _accessTokenIsValid: function() {
    if (!this._accessToken) {
      return false;
    }
    
    return new Date().getTime() < this._accessTokenValidUntil;
  },
  
  // Pass the response object from the token request here to refresh the access token
  _updateAccessToken: function (data) {
    this._accessToken = data.access_token;
    this._accessTokenValidUntil = (new Date().getTime()) + (data.expires_in - 60) * 1000;
  },
  
  _url: function(message) {
    return message.action + "?" + this._formEncode(message.parameters);
  },
  
  _request: function(message, progress, callback, errorHandler) {
    var request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(),
        target;
    
    if (message.method == "GET") {
      request.open(message.method, this._url(message), true);
    } else if (message.method == "POST") {
      request.open(message.method, message.action, true);
      request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    }
    
    if (message.useAccessToken) {
      request.setRequestHeader("Authorization", "Bearer " + this._accessToken);
    } else {
      request.setRequestHeader("Authorization", "Client-ID " + clientId);
    }
    
    if (progress) {
      request.upload.addEventListener("progress", progress, false);
    }
    
    request.onreadystatechange = function (e) {
      if (request.readyState == 4) {
        if (request.status == 200) {
          callback(request);
        } else {
          errorHandler(request);
        }
      }
    };
    request.send(message.method == "GET" ? null : this._formEncode(message.parameters));
  },
  
  _formEncode: function formEncode(parameters) {
    var form = "";
    var list = this._getParameterList(parameters);
    for (var p = 0; p < list.length; ++p) {
        var value = list[p][1];
        if (value == null) value = "";
        if (form != "") form += '&';
        form += this._percentEncode(list[p][0])
          +'='+ this._percentEncode(value);
    }
    return form;
  },
  
  _getParameterList: function getParameterList(parameters) {
    if (parameters == null) {
        return [];
    }
    if (parameters instanceof Array) {
        return parameters;
    }
    var list = [];
    for (var p in parameters) {
        list.push([p, parameters[p]]);
    }
    
    return list;
  },
  
  _percentEncode: function percentEncode(s) {
    if (s == null) {
        return "";
    }
    if (s instanceof Array) {
        var e = "";
        for (var i = 0; i < s.length; ++s) {
            if (e != "") e += '&';
            e += this._percentEncode(s[i]);
        }
        return e;
    }
    s = encodeURIComponent(s);
    // Now replace the values which encodeURIComponent doesn't do
    // encodeURIComponent ignores: - _ . ! ~ * ' ( )
    // OAuth dictates the only ones you can ignore are: - _ . ~
    // Source: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Functions:encodeURIComponent
    s = s.replace(/\!/g, "%21");
    s = s.replace(/\*/g, "%2A");
    s = s.replace(/\'/g, "%27");
    s = s.replace(/\(/g, "%28");
    s = s.replace(/\)/g, "%29");
    return s;
  }
};
