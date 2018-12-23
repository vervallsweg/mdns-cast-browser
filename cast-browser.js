const EventEmitter = require('events');
const Device = require('./device');
const mdns = require('multicast-dns')();
const debug = require('debug')('mdns-cast-browser');

class CastBrowser extends EventEmitter {
	constructor() {
		super();
		this.devices = [];
	}

	discover() {
		let that = this;
		//mdns.query('googlecast');
		mdns.query('googlezone');
		mdns.query('googlecast');

		mdns.on('error', function(error) {
			console.log('mdns-cast-browser error: ' + error);
		});

		mdns.on('response', function(packet) {
			let foundDevice = {};
			let ttl = { received: Math.round((new Date()).getTime() / 1000), values:[] };

			packet.answers.forEach(function(answer) {
				if (answer.name) {
					if (answer.name.includes('googlezone')) {
						foundDevice.groups = [];
						try {
							foundDevice.id = answer.data.split(".")[0].replace(/-/g, '');
						} catch (e) {}

						ttl.values.push(packet.answers[0].ttl);

						packet.additionals.forEach(function(additional) {
							if (additional.type === 'TXT') {
								ttl.values.push(additional.ttl);
								additional.data.forEach(function(buffer) {
									buffer = buffer.toString('utf8');

									if (buffer.includes('|') && !buffer.includes('__common_time__=')) {
										foundDevice.groups.push(buffer.split('|')[0].split('=')[0]);
									}
								});
							}
						});
					}

					if (answer.name.includes('googlecast')) {
						foundDevice.address = {};

						packet.additionals.forEach(function(additional) {
							if (additional.type === 'TXT') {
								ttl.values.push(additional.ttl);
								additional.data.forEach(function(buffer) {
									buffer = buffer.toString('utf8');
									if (buffer.includes('fn=')) {
										foundDevice.name = buffer.replace('fn=', '');
									}
									if (buffer.includes('id=')) {
										foundDevice.id = buffer.replace('id=', '');
									}
								});
							}
							if (additional.type === 'SRV') {
								ttl.values.push(additional.ttl);
								if (additional.data) {
									foundDevice.address.port = additional.data.port;
								}
							}
							if (additional.type === 'A') {
								ttl.values.push(additional.ttl);
								if (additional.data) {
									foundDevice.address.host = additional.data;
								}
							}
						});
					}
				}
			});

			if (foundDevice.id) {
				if (foundDevice.groups) {
					that.foundGroup(foundDevice, ttl);
				}
				if (foundDevice.address) {
					that.foundDevice(foundDevice, ttl);
				}
			}
		});
	};

	getDevice(id) {
		let foundDevice = false;
		this.devices.forEach(function(device) {
			if (device) {
				if (device.id === id) {
					foundDevice = device;
				}
			}
		});
		return foundDevice;
	};

	removeDevice() {
		let that = this;

		setTimeout(function() {
			if (that.devices.length === 1) {
				that.devices = [];
			} else {
				let deviceIndex = false;

				that.devices.forEach(function(device, index) {
					if (device) {
						if (device.id === null) {
							deviceIndex = index;
						}
					}
				});
				if (deviceIndex) {
					that.devices.splice(deviceIndex,1);
				}
			}
		}, 500);
	}

	foundDevice(foundDevice, ttl) {
		let device = this.getDevice(foundDevice.id);
		let that = this;

		if (device) {
			device.setDevice(foundDevice, ttl);
		} else {
			let newDevice = new Device(foundDevice, ttl);

			newDevice.on('deviceDown', device => {
				that.getDevice(device.id).remove();
				that.removeDevice(device.id);

				that.emit('deviceDown', device);
			});

			newDevice.on('deviceChange', change => {
				that.emit('deviceChange', change);
			});

			newDevice.on('groupsUp', groups => {
				that.emit('groupsUp', groups);
			});

			newDevice.on('groupsDown', groups => {
				that.emit('groupsUp', groups);
			});

			this.devices.push(newDevice);
			this.emit( 'deviceUp', newDevice.toObject() );
		}
	}

	foundGroup(foundGroup, ttl) {
		let device = this.getDevice(foundGroup.id);
		let foundGroups = foundGroup;
		let that = this;

		if (device) {
			if (foundGroups.groups) {
				foundGroups.groups.forEach(function(group, index) {
					if ( !that.deviceExists(group) ) {
						debug(foundGroup.id+' :: holding back group: '+group);
						if (foundGroups.groups.length > 1) {
							foundGroups.groups.splice(index, 1);
						} else {
							foundGroups.groups = [];
						}
					}
				});
			}
			device.setGroup(foundGroups, ttl);
		}
	}

	deviceExists(id) {
		let exists = false;
		this.devices.forEach(function(device) {
			if (device) {
				if (device.id === id) {
					 exists = true;
				}
			}
		});
		return exists;
	};

	getDevices() {
		let devices = [];
		this.devices.forEach(function(device) {
			devices.push(device.toObject());
		});
		return devices;
	};
}

module.exports = CastBrowser;