const CastBrowser = require('./cast-browser');

var cb1 = new CastBrowser();

cb1.on('deviceUp', device => {
	console.log('deviceUp: '+JSON.stringify(device));
});

cb1.on('deviceDown', device => {
	console.log('deviceDown: '+JSON.stringify(device));
});

cb1.on('deviceChange', change => {
	console.log('deviceChange: ' + JSON.stringify(change));
});

cb1.on('groupsUp', groups => {
	console.log('groupsUp: '+JSON.stringify(groups));
});

cb1.on('groupsDown', groups => {
	console.log('groupsDown: '+JSON.stringify(groups));
});

cb1.discover();

setInterval(function() {
	//console.log( JSON.stringify(cb1.getDevices()) );
}, 3000);