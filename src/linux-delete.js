var spawn = require('child_process').spawn;
var execFile = require('child_process').execFile;
var execFileSync = require('child_process').execFileSync;
var env = require('./env');

function queryConnectionSsid(name, callback) {
  var p1 = spawn('nmcli', ['connection', 'show', name], env);
  var p2 = spawn('grep', ['802-11-wireless.ssid'], env);
  var ssid = '';
  p1.stdout.on('data', data => {
    p2.stdin.write(data);
  });
  p1.on('close', code => {
    p2.stdin.end();
  });
  p2.stdout.on('data', data => {
    var fields = data.toString().split(/[ :\n]+/);
    if (fields.length >= 2) {
      ssid = fields[1];
    }
  });
  p2.on('close', code => {
    callback && callback(null, ssid);
  });
}

function listConnectionsBySsid(ssid, callback) {
  var args = [];
  args.push('--terse');
  args.push('--fields');
  args.push('name,uuid,type,device');
  args.push('connection');

  execFile('nmcli', args, env, function(err, result) {
    if (err) {
      callback && callback(err);
      return;
    }
    var lines = result.split('\n');
    var count = 0;
    var connections = [];
    lines.forEach(line => {
      if (line != '' && line.includes(':')) {
        var fields = line.replace(/\\:/g, '&&').split(':');
        if (fields[2] === '802-11-wireless') {
          queryConnectionSsid(fields[0], (err, conssid) => {
            if (ssid === conssid) {
              connections.push({
                name: fields[0],
                uuid: fields[1],
                type: fields[2],
                device: fields[3],
                ssid: conssid
              });
            }
            count++;
            if (count === lines.length) {
              callback && callback(null, connections);
            }
          });
        } else {
          count++;
          if (count === lines.length) {
            callback && callback(null, connections);
          }
        }
      } else {
        count++;
        if (count === lines.length) {
          callback && callback(null, connections);
        }
      }
    });
  });
}

function deleteConnection(config, ap, callback) {
  listConnectionsBySsid(ap.ssid, (err, connections) => {
    var err = null;
    connections.forEach(connection => {
      if (err) {
        return;
      }
      var args = [];
      args.push('connection');
      args.push('delete');
      args.push('id');
      args.push(connection.name);
      try {
        execFileSync('nmcli', args, env);
      } catch (error) {
        err = error.error;
      }
    });
    callback && callback(err);
  });
}

module.exports = function(config) {
  return function(ap, callback) {
    if (callback) {
      deleteConnection(config, ap, callback);
    } else {
      return new Promise(function(resolve, reject) {
        deleteConnection(config, ap, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  };
};
