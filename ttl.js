const EventEmitter = require('events');

class TTLObject extends EventEmitter {
	constructor() {
		super();
		this.received = null;
		this.ttlTimeout = null;
		this.values = [];
	}

	setValues(values) {
		this.values = values.values;
		this.received = values.received;
	}

	start() {
		// eslint-disable-next-line prefer-spread
		const lowest = Math.min.apply(Math, Object.values(this.values));
		const { received } = this;
		const that = this;

		if (received && lowest) {
			this.ttlTimeout = setTimeout(() => {
				that.emit('serviceDown', { received, lowest, now: Math.round((new Date()).getTime() / 1000) });
				// console.log('TTLObject expired received: '+received+', ttl: '+lowest);
			}, lowest * 1000);
		} else {
			console.log(`mdns-cast-browser, error: TTLObject.start(), without lowest (${lowest}) or received (${received})`);
		}
	}

	reset() {
		if (this.ttlTimeout) {
			clearTimeout(this.ttlTimeout);
		}
	}
}

module.exports = TTLObject;
