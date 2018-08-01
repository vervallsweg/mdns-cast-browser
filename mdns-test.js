const mdns = require('multicast-dns')();
const txt = require('dns-txt')();
const util = require('util');

var castDevivces = [];
discoverDevices();

setInterval(function() {
	var devices = [];
	castDevivces.forEach(function(castDevivce) {
		devices.push( castDeviceToString(castDevivce) );
	});
	console.log( JSON.stringify(devices) );
}, 2000);

function discoverDevices() {
	mdns.query('googlecast');
	mdns.query('googlezone');

	mdns.on('error', function(error) {
		console.log('Error: ' + error);
	})

	mdns.on('response', function(packet) {
		var castDevivce = {};
		castDevivce.ttl = {};
		castDevivce.ttl.values = {};
		castDevivce.ttl.received = Math.round((new Date()).getTime() / 1000);
		//console.log(packet);

		packet.additionals.forEach(function(additional) {
			if (additional.type == 'TXT') {
				castDevivce.ttl.values.TXT = additional.ttl;
				additional.data.forEach(function(buffer) {
					buffer = buffer.toString('utf8');
					if (buffer.includes('fn=')) {
						castDevivce.name = buffer.replace('fn=', '');
					}
					if (buffer.includes('id=')) {
						castDevivce.id = buffer.replace('id=', '');
					}
					if (buffer.includes('|') && !buffer.includes('__common_time__=')) {
						if (!castDevivce.groups) {
							castDevivce.groups = [];
						}
						castDevivce.groups.push(buffer.split('|')[0].split('=')[0]);
						//console.log('group: ' + group);
					}
				});
			}
			if (additional.type == 'SRV') {
				castDevivce.ttl.values.SRV = additional.ttl;
				if (additional.data) {
					castDevivce.port = additional.data.port;
				}
			}
			if (additional.type == 'A') {
				castDevivce.ttl.values.A = additional.ttl;
				if (additional.data) {
					castDevivce.ip = additional.data;
				}
			}
		});

		packet.answers.forEach(function(answer) {
			if (answer.name) {
				if (answer.name.includes('googlezone')) {
					delete castDevivce.ip;
					delete castDevivce.port;
					if (castDevivce.id) {
						castDevivce.id = castDevivce.id.replace(/-/g, '');
					}
					var groups = { ttl: castDevivce.ttl, groups: castDevivce.groups };
					castDevivce.groups = groups;
					//console.log('googlezone: ' + JSON.stringify(castDevivce));
					//castDevivce = null;
				}
			}
		});

		if (castDevivce) {
			if (castDevivce.id) {
				setCastDevice(castDevivce.id, castDevivce); //TODO: getCastDevice().updateAddress();
			}
		}
	});
}

function castDevivceExists(id) {
	var exists = false;
	castDevivces.forEach(function(castDevivce) {
		if (castDevivce) {
			if (castDevivce.id == id) {
				exists = true;
			}
		}
	});
	return exists;
}

function getCastDevice(id) {
	var foundCastDevivce;
	castDevivces.forEach(function(castDevivce) {
		if (castDevivce) {
			if (castDevivce.id == id) {
				 foundCastDevivce = castDevivce;
			}
		}
	});
	return foundCastDevivce;
}

function castDeviceToString(castDevivce) {
	var obj = {
		id: castDevivce.id,
		name: castDevivce.name,
		port: castDevivce.port,
		ip: castDevivce.ip
	}
	if (castDevivce.groups) {
		obj.groups = castDevivce.groups.groups;
	}
	return obj;
}

function setCastDevice(id, newCastDevice) {
	if (castDevivceExists(id)) {
		castDevivces.forEach(function(castDevivce) {
			if (castDevivce) {
				if (castDevivce.id == id) {
					if (newCastDevice.groups) {
						if (!castDevivce.groups) {
							//console.log('newGoogleZone: ' + JSON.stringify(newCastDevice));
						}
						castDevivce.groups = newCastDevice.groups;
						if (castDevivce.groups.ttl.ttlTimeout) { //cannot read property of undefined
							//console.log(id+' = responded in time, resetting group TTL');
							clearTimeout(castDevivce.groups.ttl.ttlTimeout);
						}
					} else {
						if (castDevivce.ttl.ttlTimeout) {
							//console.log(id+' = responded in time, resetting device TTL');
							clearTimeout(castDevivce.ttl.ttlTimeout);
						}
						castDevivce = newCastDevice;
						//console.log('updatingCastDevivce: ' + JSON.stringify(castDevivce));
					}
				}
			}
		});
	} else {
		if (!newCastDevice.groups) {
			castDevivces.push(newCastDevice);
			//console.log('newCastDevice: ' + JSON.stringify(newCastDevice));
		}
	}
	
	if (newCastDevice.groups) {
		//castGroupSetTTL(id);
	} else {
		castDevivceSetTTL(id);
	}
}

function castDevivceSetTTL(id) {
	var castDevivce = getCastDevice(id);

	if (castDevivce) {
		var lowestTTL = getCastDeviceLowestTTL(castDevivce.ttl.values);
		castDevivce.ttl.ttlTimeout = setTimeout(function(lowestTTL) {
			console.log(id+' :::: device didnot reply in time should: ' + (castDevivce.ttl.received + lowestTTL) + ', now: ' + Math.round((new Date()).getTime() / 1000) ); 
		}, lowestTTL*1000);
	}
}

function castGroupSetTTL(id) {
	var castDevivce = getCastDevice(id);

	if (castDevivce) {
		var lowestTTL = getCastDeviceLowestTTL(castDevivce.groups.ttl.values);
		castDevivce.groups.ttl.ttlTimeout = setTimeout(function(lowestTTL) {
			console.log(id+' :::: group didnot reply in time should: ' + (castDevivce.groups.ttl.received + lowestTTL) + ', now: ' + Math.round((new Date()).getTime() / 1000) ); 
		}, lowestTTL*1000);
	}
}

function getCastDeviceLowestTTL(ttlValues) {
	return Math.min.apply(Math, Object.values(ttlValues))
}

function createGoogleZone(response) {
	console.log('createGoogleZone, response: '+JSON.stringify(response));
}

function createGoogleCastDevice(response) {
	console.log('createGoogleCastDevice, response: '+JSON.stringify(response));
}