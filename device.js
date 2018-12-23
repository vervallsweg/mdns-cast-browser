const EventEmitter = require('events');
const TTL = require('./ttl');

class Device extends EventEmitter {
	constructor(device, ttl) {
		super();

		this.id = device.id;
		this.device = {values: device, ttl: new TTL() };
		this.group = {values:[], ttl: new TTL() };

		this.device.ttl.setValues(ttl);
		this.device.ttl.start();

		this.device.ttl.on('serviceDown', service=>{
			this.emit( 'deviceDown', this.toObject() );
		});

		this.group.ttl.on('serviceDown', service=>{
			//this.emit('groupsDown', this.group.values);
			this.emit('groupsDown', {id: this.id, groups: this.group.values});
			this.group.values = [];
		});
	};

	setDevice(newDevice, newTTL) {
		this.device.ttl.reset();
		this.device.ttl.setValues(newTTL);
		let newAddress = false;

		if (this.device.values.name !== newDevice.name) {
			this.emit('deviceChange', {id: this.id, kind:'name', value: newDevice.name});
		}
		if (this.device.values.address.host !== newDevice.address.host) {
			newAddress = true;
		}
		if (this.device.values.address.port !== newDevice.address.port) {
			newAddress = true;
		}
		if (newAddress) {
			this.emit('deviceChange', {id: this.id, kind:'address', value: newDevice.address});
		}
		this.device.values = newDevice;
		this.device.ttl.start();
	};

	setGroup(newGroup, newTTL) {
		this.group.ttl.reset();
		this.group.ttl.setValues(newTTL);
		let that = this;

		if (this.group.values) {
			this.group.values.forEach(function(group) {
				if (newGroup.groups) {
					if ( !newGroup.groups.includes(group) ) {
						that.emit('groupsDown', {id: that.id, groups: [group]}); //removed
					}
				}
			});
		}
		if (newGroup.groups) {
			newGroup.groups.forEach(function(group) {
				if (that.group.values) {
					if ( !that.group.values.includes(group) ) {
						that.emit('groupsUp', {id: that.id, groups: [group]}); //added
					}
				}
			});
		}
		this.group.values = newGroup.groups;
		this.group.ttl.start();
	};

	toObject() {
		return {
			id: this.id,
			name: this.device.values.name,
			address: this.device.values.address,
			groups: this.group.values
		};
	}

	remove() {
		this.device.ttl.reset();
		this.group.ttl.reset();
		// this.device = null;
		// this.group = null;
		this.id = null;
	}
}

module.exports = Device;