var EXPORTED_SYMBOLS = ["strings"];

var strings = {
	bundle: null,
	getString: function(stringKey) {
		return this.bundle.getString(stringKey);
	}
}