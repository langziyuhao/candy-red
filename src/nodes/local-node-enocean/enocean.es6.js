/**
 * @license
 * Copyright (c) 2018 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
/*
 * EnOcean Serial Node for Packet Type 10: RADIO_ERP2
 * Supported Protocols (Partially):
 * - EnOcean Serial Protocol 3 (ESP3) V1.27 / July 30, 2014
 * - EnOcean Radio Protocol 2 SPECIFICATION V1.0 September 26, 2013
 *
 * This node expects 'node-red-node-serialport' to be available
 * on the editor in order to use its `/serialports` endpoint.
 */

import fs from 'fs';
import path from 'path';
import serialport from 'serialport';

import { SerialPool } from './lib/enocean';
import { ERP2_TEACH_IN_HANDLERS, ERP2_HANDLERS } from './lib/eep_handlers';

const ENOCEAN_LEARN_MODE_TIMEOUT = parseInt(process.env.ENOCEAN_LEARN_MODE_TIMEOUT) || (30 * 60 * 1000);
const ENOCEAN_LEARN_MODE_THRESHOLD_MS = parseInt(process.env.ENOCEAN_LEARN_MODE_THRESHOLD_MS) || (2 * 1000);
const ENOCEAN_LEARN_MODE_THRESHOLD_RSSI = parseInt(process.env.ENOCEAN_LEARN_MODE_THRESHOLD_RSSI) || (47);

let learnedIDs = null;

export default function(RED) {

  class EnOceanPortNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      try {
        this.serialPort = n.serialPort;
        EnOceanPortNode.pool.add(this);
      } catch (e) {
        this.error(RED._('enocean.errors.serialPortError', { error: e }));
      }
    }
  }
  EnOceanPortNode.pool = new SerialPool(RED);
  RED.nodes.registerType('EnOcean Port', EnOceanPortNode);

  function createIDfilePath() {
    return path.join(RED.settings.userDir, 'enocean-ids.json');
  }

  function saveLearnedIDs(node) {
    let id = node.id;
    if (!learnedIDs) {
      learnedIDs = {};
    }
    learnedIDs[id] = node.originatorId;
    fs.writeFile(createIDfilePath(), JSON.stringify(learnedIDs), (err) => {
      if (err) {
        node.error('Failed to write detected OriginatorID!', err);
      }
    });
  }

  function loadLearnedIDs(id) {
    if (!learnedIDs) {
      try {
        let data = fs.readFileSync(createIDfilePath());
        learnedIDs = JSON.parse(data);
      } catch (_) {
        learnedIDs = {};
      }
    }
    return learnedIDs[id];
  }

  function addEventListener(node) {
    let enocean = EnOceanPortNode.pool.get(node.enoceanPortNode.serialPort);
    if (isNaN(node.originatorIdInt)) {
      node.learning = true;
      node.learningCount = 0;
      node.learnEventAt = 0;
      if (node.learningTimeout) {
        clearTimeout(node.learningTimeout);
      }
      node.learningTimeout = setTimeout(() => {
        node.emit('timeout');
      }, ENOCEAN_LEARN_MODE_TIMEOUT);
      enocean.port.on('learn', (ctx) => {
        if (node.learning &&
            ctx.container.dBm <= ENOCEAN_LEARN_MODE_THRESHOLD_RSSI &&
            node.isValidLearnPacket(ctx, node.ignoreLRNBit)) {
          if (node.learningCount === 0) {
            node.learnEventAt = Date.now();
          }
          if (Date.now() - node.learnEventAt <= ENOCEAN_LEARN_MODE_THRESHOLD_MS) {
            ++node.learningCount;
            if (node.learningCount >= node.learningThresholdCount) {
              node.originatorId = ctx.originatorId;
              node.originatorIdInt = ctx.originatorIdInt;
              if (!isNaN(node.originatorIdInt)) {
                saveLearnedIDs(node);
                addEventListener(node);
              }
            }
          } else {
            node.learningCount = 0;
            node.learnEventAt = 0;
          }
        } else if (node.showEnOceanWarning) {
          node.warn(RED._('enocean.warn.noNode', { originatorId: ctx.originatorId }));
        }
      });
    } else {
      node.learning = false;
      enocean.port.on(`ctx-${node.originatorIdInt}`, ctx => {
        let handleIt = ERP2_HANDLERS[node.eepType];
        if (!handleIt) {
          if (node.showEnOceanWarning) {
            node.warn(RED._('enocean.warn.noHandler', { eepType: node.eepType }));
          }
          return;
        }
        let payload = handleIt(ctx);
        payload.tstamp = Date.now();
        payload.rssi = ctx.container.dBm;
        payload.id = ctx.originatorId; // hex string
        if (node.addEepType) {
          payload.eep = node.eepType;
        }
        if (node.useString) {
          payload = JSON.stringify(payload);
        }
        let topic = `${node.eepType}/${payload.id}`;
        node.send({ topic: topic, payload: payload });
      });
      if (node.learningTimeout) {
        clearTimeout(node.learningTimeout);
        delete node.learningTimeout;
      }
      node.emit('learned');
    }
  }

  class EnOceanInNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.name = n.name;
      this.alwaysStartAsLearningMode = n.alwaysStartAsLearningMode || false;
      this.originatorId = n.originatorId;
      if (!n.originatorId) {
        if (!n.alwaysStartAsLearningMode) {
          this.originatorId = loadLearnedIDs(this.id);
        }
      }
      this.originatorIdInt = parseInt(this.originatorId, 16);
      this.eepType = n.eepType;
      this.addEepType = n.addEepType;
      this.useString = n.useString;
      this.showEnOceanWarning = n.showEnOceanWarning || true;
      this.enoceanPortNodeId = n.enoceanPort;
      this.enoceanPortNode = RED.nodes.getNode(this.enoceanPortNodeId);
      this.ignoreLRNBit = n.ignoreLRNBit || false;
      this.learning = false;
      if (this.eepType) {
        let rorg = this.eepType.substring(0, 2);
        switch (rorg) {
          case 'f6': // RPS
            this.learningThresholdCount = 2;
            break;
          case 'd5': // 1BS
            this.learningThresholdCount = 1;
            break;
          case 'a5': // 4BS
            this.learningThresholdCount = 1;
            break;
          default:
            this.learningThresholdCount = 1;
        }
        this.isValidLearnPacket = ERP2_TEACH_IN_HANDLERS[rorg];
      }
      this.status({});
      this.on('learned', () => {
        this.learning = false;
        this.status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
        this.warn(RED._('enocean.warn.learned', { name: (this.name || this.id), originatorId: this.originatorId }));
      });
      this.on('timeout', () => {
        this.learning = false;
        this.status({ fill: 'red', shape: 'ring', text: 'enocean.status.timeout'});
      });
      this.on('close', (done) => {
        if (this.enoceanPortNode) {
          EnOceanPortNode.pool.close(this.enoceanPortNode.serialPort).then(() => {
            done();
          });
        } else {
          done();
        }
      });
      try {
        let enocean = EnOceanPortNode.pool.get(this.enoceanPortNode.serialPort);
        enocean.port.on('ready', () => {
          addEventListener(this);
          if (this.learning) {
            this.status({ fill: 'blue', shape: 'dot', text: 'enocean.status.learning'});
          }
        });
        enocean.port.on('closed', () => {
          this.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.not-connected'});
        });
      } catch (e) {
        this.error(RED._('enocean.errors.serialPortError', { error: e }));
      }
    }
  }
  RED.nodes.registerType('EnOcean in', EnOceanInNode);

  RED.httpAdmin.get('/eeps', RED.auth.needsPermission('eep.read'), function(req,res) {
    res.json(Object.keys(ERP2_HANDLERS));
  });
  RED.httpAdmin.get('/enoceanports', RED.auth.needsPermission('serial.read'), function(req,res) {
    let list = [];
    fs.stat('/dev/enocean', (err) => {
      if (!err) {
        list.push({
          comName: '/dev/enocean'
        });
      }
      serialport.list(function (_, ports) {
        res.json(list.concat(ports));
      });
    });
  });

}
