Object.defineProperty(exports, '__esModule', {
  value: !0
});

var _libEnocean = require('./lib/enocean'),
    _libEep_handlers = require('./lib/eep_handlers');

exports['default'] = function (e) {
  function t(n) {
    e.nodes.createNode(this, n);
    var r = this;

    try {
      r.serialPort = n.serialPort, t.pool.add(r);
    } catch (s) {
      e.log.warn(e._('enocean.errors.serialPortError', {
        error: s
      }));
    }
  }

  function n(n) {
    e.nodes.createNode(this, n);
    var r = this;
    r.name = n.name, r.originatorId = n.originatorId, r.eepType = n.eepType, r.addEepType = n.addEepType, r.useString = n.useString, r.enoceanPortNodeId = n.enoceanPort, r.enoceanPortNode = e.nodes.getNode(r.enoceanPortNodeId), r.on('close', function (e) {
      r.enoceanPortNode ? t.pool.close(r.enoceanPortNode.serialPort).then(function () {
        e();
      }) : e();
    });

    try {
      var s = t.pool.get(r.enoceanPortNode.serialPort);
      s.port.on('ctx-' + r.originatorId, function (t) {
        var n = _libEep_handlers.ERP2_HANDLERS[r.eepType];
        if (!n) return void e.log.warn(e._('enocean.warn.noHandler', {
          eepType: r.eepType
        }));
        var s = n(t);
        s.tstamp = Date.now(), s.rssi = t.container.dBm, s.id = t.originatorId, r.addEepType && (s.eep = r.eepType), r.useString && (s = JSON.stringify(s)), r.send({
          payload: s
        });
      }), s.port.on('ready', function () {
        r.status({
          fill: 'green',
          shape: 'dot',
          text: 'node-red:common.status.connected'
        });
      }), s.port.on('closed', function () {
        r.status({
          fill: 'red',
          shape: 'ring',
          text: 'node-red:common.status.not-connected'
        });
      });
    } catch (o) {
      e.log.warn(e._('enocean.errors.serialPortError', {
        error: o
      }));
    }
  }

  t.pool = new _libEnocean.SerialPool(e), e.nodes.registerType('EnOcean Port', t), e.nodes.registerType('EnOcean in', n), e.httpAdmin.get('/eeps', e.auth.needsPermission('eep.read'), function (e, t) {
    t.json(Object.keys(_libEep_handlers.ERP2_HANDLERS));
  });
}, module.exports = exports['default'];

/*
 * EnOcean Serial Node for Packet Type 10: RADIO_ERP2
 * Supported Protocols (Partially):
 * - EnOcean Serial Protocol 3 (ESP3) V1.27 / July 30, 2014
 * - EnOcean Radio Protocol 2 SPECIFICATION V1.0 September 26, 2013
 *
 * This node expects 'node-red-node-serialport' to be available
 * on the editor in order to use its `/serialports` endpoint.
 */
//# sourceMappingURL=enocean.js.map