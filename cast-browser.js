const EventEmitter = require('events');
const mdns = require('multicast-dns')();
const debug = require('debug')('mdns-cast-browser');
const Device = require('./device');

class CastBrowser extends EventEmitter {
	constructor() {
		super();
		this.devices = [];
	}

	discover() {
		const that = this;
		// mdns.query('googlecast');
		mdns.query('googlezone');
		mdns.query('googlecast');

		mdns.on('error', (error) => {
			console.log(`mdns-cast-browser error: ${error}`);
		});

		mdns.on('response', (packet) => {
			const foundDevice = {};
			const ttl = { received: Math.round((new Date()).getTime() / 1000), values: [] };

			packet.answers.forEach((answer) => {
				if (answer.name) {
					if (answer.name.includes('googlezone')) {
						foundDevice.groups = [];
						try {
							foundDevice.id = answer.data.split('.')[0].replace(/-/g, '');
						} catch (e) {
							debug(`${foundDevice.id} :: replace error ${e}`);
						}

						ttl.values.push(packet.answers[0].ttl);

						packet.additionals.forEach((additional) => {
							if (additional.type === 'TXT') {
								ttl.values.push(additional.ttl);
								additional.data.forEach((buffer) => {
									const message = buffer.toString('utf8');

									if (message.includes('|') && !message.includes('__common_time__=')) {
										foundDevice.groups.push(message.split('|')[0].split('=')[0]);
									}
								});
							}
						});
					}

					if (answer.name.includes('googlecast')) {
						foundDevice.address = {};

						packet.additionals.forEach((additional) => {
							if (additional.type === 'TXT') {
								ttl.values.push(additional.ttl);
								additional.data.forEach((buffer) => {
									const message = buffer.toString('utf8');

									if (message.includes('fn=')) {
										foundDevice.name = message.replace('fn=', '');
									}
									if (message.includes('id=')) {
										foundDevice.id = message.replace('id=', '');
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
	}

	getDevice(id) {
		let foundDevice = false;
		this.devices.forEach((device) => {
			if (device) {
				if (device.id === id) {
					foundDevice = device;
				}
			}
		});
		return foundDevice;
	}

	removeDevice() {
		const that = this;

		setTimeout(() => {
			if (that.devices.length === 1) {
				that.devices = [];
			} else {
				let deviceIndex = false;

				that.devices.forEach((device, index) => {
					if (device) {
						if (device.id === null) {
							deviceIndex = index;
						}
					}
				});
				if (deviceIndex) {
					that.devices.splice(deviceIndex, 1);
				}
			}
		}, 500);
	}

	foundDevice(foundDevice, ttl) {
		const existingDevice = this.getDevice(foundDevice.id);
		const that = this;

		if (existingDevice) {
			existingDevice.setDevice(foundDevice, ttl);
		} else {
			const newDevice = new Device(foundDevice, ttl);

			newDevice.on('deviceDown', (device) => {
				that.getDevice(device.id).remove();
				that.removeDevice(device.id);

				that.emit('deviceDown', device);
			});

			newDevice.on('deviceChange', (change) => {
				that.emit('deviceChange', change);
			});

			newDevice.on('groupsUp', (groups) => {
				that.emit('groupsUp', groups);
			});

			newDevice.on('groupsDown', (groups) => {
				that.emit('groupsUp', groups);
			});

			this.devices.push(newDevice);
			this.emit('deviceUp', newDevice.toObject());
		}
	}

	foundGroup(foundGroup, ttl) {
		const device = this.getDevice(foundGroup.id);
		const foundGroups = foundGroup;
		const that = this;

		if (device) {
			if (foundGroups.groups) {
				foundGroups.groups.forEach((group, index) => {
					if (!that.deviceExists(group)) {
						debug(`${foundGroup.id} :: holding back group: ${group}`);
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
		this.devices.forEach((device) => {
			if (device) {
				if (device.id === id) {
					exists = true;
				}
			}
		});
		return exists;
	}

	getDevices() {
		const devices = [];
		this.devices.forEach((device) => {
			devices.push(device.toObject());
		});
		return devices;
	}
}

module.exports = CastBrowser;
