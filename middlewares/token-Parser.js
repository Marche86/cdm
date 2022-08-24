// the middleware function
module.exports = function() {


	return function(req, res, next) {
		
		var uid;
		
		if (req.headers.token) {
			uid = req.headers.token;
		} else if(req.query.token) {
			uid = req.query.token;
		} else if(req.body.token) {
			uid = req.body.token;
		} else {
			uid = undefined;
		}
		
		req.session = { uid : uid };
		
		next();
	};

};