const EventEmitter = require('events');

class TTLObject extends EventEmitter {
	constructor() {
		super();
		this.received;
		this.ttlTimeout = null;
		this.values = [];
	}
	
	setValues(values) {
		this.values = values.values;
		this.received = values.received;
	};

	start() {
		let lowest = Math.min.apply(Math, Object.values(this.values));
		let received = this.received;
		let that = this;

		if (received && lowest) {
			this.ttlTimeout = setTimeout(function() {
				that.emit('serviceDown', {received:received, lowest:lowest, now:Math.round((new Date()).getTime() / 1000)});
				//console.log('TTLObject expired received: '+received+', ttl: '+lowest); 
			}, lowest*1000);
		} else {
			console.log('mdns-cast-browser, error: TTLObject.start(), without lowest ('+lowest+') or received ('+received+')');
		}
	};

	reset() {
		if (this.ttlTimeout) {
			clearTimeout(this.ttlTimeout);
		}
	};
}

module.exports = TTLObject;