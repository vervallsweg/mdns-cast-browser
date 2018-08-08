const EventEmitter = require('events');
const Device = require('./device');
const mdns = require('multicast-dns')();
const util = require('util');
const debug = require('debug')('mdns-cast-browser');

class CastBrowser extends EventEmitter {
	constructor() {
		super();
		this.devices = [];
	}

	discover() {
		var that = this;
		//mdns.query('googlecast');
		mdns.query('googlezone');
		mdns.query('googlecast');

		mdns.on('error', function(error) {
			console.log('mdns-cast-browser error: ' + error);
		});

		mdns.on('response', function(packet) {
			var foundDevice = {};
			var ttl = { received: Math.round((new Date()).getTime() / 1000), values:[] };

			packet.answers.forEach(function(answer) {
				if (answer.name) {
					if (answer.name.includes('googlezone')) {
						foundDevice.groups = [];

						ttl.values.push(packet.answers[0].ttl);

						packet.additionals.forEach(function(additional) {
							if (additional.type == 'TXT') {
								ttl.values.push(additional.ttl);
								additional.data.forEach(function(buffer) {
									buffer = buffer.toString('utf8');
									
									if (buffer.includes('id=')) {
										foundDevice.id = buffer.replace('id=', '').replace(/-/g, ''); //TODO: good idea for matching?
									}
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
							if (additional.type == 'TXT') {
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
							if (additional.type == 'SRV') {
								ttl.values.push(additional.ttl);
								if (additional.data) {
									foundDevice.address.port = additional.data.port;
								}
							}
							if (additional.type == 'A') {
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
		var foundDevice = false;
		this.devices.forEach(function(device) {
			if (device) {
				if (device.id == id) {
					foundDevice = device;
				}
			}
		});
		return foundDevice;
	};

	removeDevice() {
		var that = this;

		setTimeout(function() {
			if (that.devices.length == 1) {
				that.devices = [];
			} else {
				var deviceIndex = false;

				that.devices.forEach(function(device, index) {
					if (device) {
						if (device.id == null) {
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
		var device = this.getDevice(foundDevice.id);
		var that = this;

		if (device) {
			device.setDevice(foundDevice, ttl);
		} else {
			var newDevice = new Device(foundDevice, ttl);

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
		var device = this.getDevice(foundGroup.id);
		var foundGroups = foundGroup;
		var that = this;

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
		var exists = false;
		this.devices.forEach(function(device) {
			if (device) {
				if (device.id == id) {
					 exists = true;
				}
			}
		});
		return exists;
	};

	getDevices() {
		var devices = [];
		this.devices.forEach(function(device) {
			devices.push(device.toObject());
		});
		return devices;
	};
};

module.exports = CastBrowser;