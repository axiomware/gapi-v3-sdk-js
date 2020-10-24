/*
 * Netrunr GAPI V3 MQTT asynchronous API
 *
 * Copyright(C) 2020 Axiomware Systems Inc..
 */

'use strict'
const debuglib = require('debug')
const debug = debuglib('axm:gapi-v3-client')
const debugadv = debuglib('axm:gapi-v3-client:adv')
const debugmqtt = debuglib('axm:gapi-v3-client:mqtt')
const EventEmitter = require('events')
const gMQTT = require('mqtt')
const assert = require('assert')
const gMQTTPattern = require('mqtt-pattern')
const gateway = require('./gapi-ble-link.js')
const GAPIV3 = require('./gapi-v3-constants.js')

const gDefaultTimeout = 30000 /* default timeout in ms */
const gHBTInterval = 60000 /* Hearbeat interval in ms */
const gLINK = {
  INIT: 0,
  CONNECT: 1,
  RECONNECT: 2,
  CLOSE: 3,
  DISCONNECT: 4,
  OFFLINE: 5,
  ERROR: 6,
  END: 7
}

// const gClientId = 'axm_' + Math.random().toString(16).substr(2, 8);
const gClientOptionsDefault = {
  keepalive: 10,
  reconnectPeriod: 1000,
  connectTimeout: 30 * 1000,
  clientId: null,
  protocolId: 'MQTT',
  protocolVersion: 5
//    clean: false,
}

class GapiClient extends EventEmitter {
  constructor (clientID, MQTT5 = false, mqttRetain = false) {
    super() // event emitter
    gClientOptionsDefault.clientId = clientID || 'axm_' + Math.random().toString(16).substr(2, 10)
    this._MQTTlastConnEvt = gLINK.INIT
    this._MQTTclient = null
    this._MQTToptions = null
    this._topicPrefix = null // topic should include trailing /
    this._topicHeartBeat = null
    this._topicFilter = null
    this._GW = {}
    this._hbtCount = 0
    this._GWHBTList = {}
    this._devType = GAPIV3.DEV_TYPE_CLIENT
    this._MQTT5 = MQTT5
    this._retain = mqttRetain
  }

  get clientID () {
    return this._MQTToptions.clientId
  }

  listGW () {
    const gwArray = []
    for (const gw in this._GWHBTList) {
      gwArray.push(this._GWHBTList[gw])
    }
    return (gwArray)
  }

  getBleLinkStatus (gwid) {
    const lgwid = gwid.toLowerCase()
    if (lgwid in this._GW) {
      return this._GW[lgwid]._gwConnectedState
    } else {
      return false
    }
  }

  async init (host, port, options, topicPrefix, tls) {
    const self = this
    assert(topicPrefix, 'topicPrefix should not be null')

    self._topicPrefix = topicPrefix.endsWith('/') ? `${topicPrefix}` : `${topicPrefix}/`
    self._topicFilter = `${self._topicPrefix}+id/+iface/+ch/#addr`
    self._topicHeartBeat = `${self._topicPrefix}+/0/7/0`

    self._MQTToptions = Object.assign({}, gClientOptionsDefault, options)

    self._MQTToptions.will = {
      topic: `${this._topicPrefix}${self.clientID}/0/8/0`,
      payload: null,
      retain: self._retain
    }
    let hstr = null;
    self._MQTToptions.protocolVersion = this._MQTT5? 5: 4;
    if(!tls){
      self._MQTToptions['key'] = null
      self._MQTToptions['cert'] = null
      self._MQTToptions['ca'] = null
      hstr = 'mqtt://' + host + ':' + port
    } else {
      hstr = 'mqtts://' + host + ':' + port
    }



    debug({ log: self._MQTToptions }, `[${self.clientID}]:connect :: MQTT options for MQTT broker ${hstr}`)

    self._MQTTclient = gMQTT.connect(hstr, self._MQTToptions)
    if (!self._MQTTclient) {
      debug({ log: null }, `[${self.clientID}]:connect :: unable to connect to MQTT broker ${hstr}`)
    } else {
      debug({ log: null }, `[${self.clientID}]:connect :: connected to MQTT broker ${hstr}`)
    }

    function getMQTTtopicSubscribeList () {
      const topicArray = [self._topicHeartBeat]
      for (const gw in self._GW) {
        self._GW[gw]._topics.static.forEach((topic) => { topicArray.push(topic) })
        self._GW[gw]._topics.adv.forEach((topic) => { topicArray.push(topic) })
        for (const node in self._GW[gw]._dev) {
          for (const handle in self._GW[gw]._dev[node]._topics) {
            topicArray.push(self._GW[gw]._dev[node]._topics[handle][0])
          }
        }
      }
      return topicArray
    }

    async function _mqttHeartbeatFunc () {
      self._hbtCount++
      if (self._MQTTclient.connected) {
        const payload = { type: self._devType, date: Math.floor(Date.now()), id: self.clientID, iface: [10], seq: self._hbtCount }
        const hbtTopic = `${self._topicPrefix}${self.clientID}/0/8/0`

        await self.mqttPublishAsync(hbtTopic, JSON.stringify(payload), { retain: self._retain })
        debug({ log: payload }, `[${self.clientID}]:_mqttHeartbeatFunc :: Heartbeat Published`)
        debug({ log: { retain: self._retain } }, `[${self.clientID}]:_mqttHeartbeatFunc :: Heartbeat Published retain`)
      }
    }

    function _heartBeatHandler (mqttTopics, topic, message, packet) {
      var dc = Date.now()
      const data = {
        type: 0,
        id: mqttTopics.id,
        date: dc,
        dateDiff: 0,
        retain: false,
        rcount: 0,
        lcount: 0,
        online: false,
        connected: false
      }

      self._GWHBTList[mqttTopics.id] = self._GWHBTList[mqttTopics.id] || data
      self._GWHBTList[mqttTopics.id].id = mqttTopics.id
      self._GWHBTList[mqttTopics.id].retain = packet.retain
      self._GWHBTList[mqttTopics.id].lcount++

      if (message == '') { // LWT message
        debug({ log: null }, `[${mqttTopics.id}]:_heartBeatHandler :: received LWT`)
        self._GWHBTList[mqttTopics.id].online = false
        self._GWHBTList[mqttTopics.id].date = dc
        self._GWHBTList[mqttTopics.id].dateDiff = 0
        self._GWHBTList[mqttTopics.id].rcount++
      } else {
        let msg = null

        try {
          msg = JSON.parse(message)
          debug({ log: msg }, `[${mqttTopics.id}]:_heartBeatHandler :: Heartbeat received`)

          const dm = parseInt(msg.date)
          self._GWHBTList[mqttTopics.id].online = true
          self._GWHBTList[mqttTopics.id].date = dm
          self._GWHBTList[mqttTopics.id].dateDiff = dc - dm
          self._GWHBTList[mqttTopics.id].rcount = msg.seq
          self._GWHBTList[mqttTopics.id].type = msg.type
          self.emit('heartbeat', Object.assign({}, self._GWHBTList[mqttTopics.id]))
        } catch (err) {
          debug(err, `[${mqttTopics.id}]:_heartBeatHandler :: Heartbeat received ${message} with unknown format`)
        }
      }
    }

    async function onConnectHandler () {
      const tList = getMQTTtopicSubscribeList()

      debug({ log: null }, `[${self.clientID}]:onConnectHandler :: subscribing to topics: ${tList}`)
      await self.mqttSubscribeAsync(tList, { nl: true })

      if (self._hbtTimerID != null) {
        clearInterval(self._hbtTimerID)
      }
      _mqttHeartbeatFunc()
      self._hbtTimerID = setInterval(() => { _mqttHeartbeatFunc() }, gHBTInterval)
    }

    self._MQTTclient.on('connect', async function (connack) {
      self._MQTTlastConnEvt = gLINK.CONNECT

      debug({ log: null }, `[${self.clientID}]:connect :: connected to MQTT broker`)

      await onConnectHandler()
    })

    self._MQTTclient.on('reconnect', async function () {
      self._MQTTlastConnEvt = gLINK.RECONNECT

      debug({ log: null }, `[${self.clientID}]:reconnect :: reconnected to MQTT broker`)

      await onConnectHandler()
    })

    self._MQTTclient.on('disconnect', function () {
      self._MQTTlastConnEvt = gLINK.DISCONNECT

      debug({ log: null }, `[${self.clientID}]:disconnect :: disconnected from MQTT broker`)
    })

    self._MQTTclient.on('close', function () {
      self._MQTTlastConnEvt = gLINK.CLOSE

      debug({ log: null }, `[${self.clientID}]:close :: close from MQTT broker`)
    })

    self._MQTTclient.on('offline', function () {
      self._MQTTlastConnEvt = gLINK.OFFLINE

      debug({ log: null }, `[${self.clientID}]:offline :: offline from MQTT broker`)
    })

    self._MQTTclient.on('error', function (err) {
      self._MQTTlastConnEvt = gLINK.ERROR

      debug({ log: err }, `[${self.clientID}]:error :: error from MQTT broker`)
    })

    self._MQTTclient.on('end', function () {
      self._MQTTlastConnEvt = gLINK.END

      debug({ log: null }, `[${self.clientID}]:end :: end from MQTT broker`)
    })

    self._MQTTclient.on('message', async function (topic, message, packet) {
      const mqttMatch = gMQTTPattern.exec(self._topicFilter, topic)

      if (mqttMatch) {
        if ((mqttMatch.ch == 7) && (mqttMatch.iface == 0) && (mqttMatch.addr[0] == 0)) {
          _heartBeatHandler(mqttMatch, topic, message, packet)
        } else if ((mqttMatch.iface == 1) && self._GW[mqttMatch.id]) {
          try {
            const msgData = JSON.parse(message)

            await self._GW[mqttMatch.id]._dataHandler(mqttMatch, msgData, packet)
          } catch (err) {
            debug(err, `[${mqttMatch.id}]:message :: JSON.parse error for message: ${message} to topic: ${topic}`)
          }
        } else {
          debug({ log: null }, `[${mqttMatch.id}]:message :: message: ${message} to unsupported topic: ${topic}`)
        }
      } else {
        debug({ log: null }, `[]:message :: message: ${message} to unmatched topic: ${topic}`)
      }
    })

    await this.sleep(1000)

    return self._MQTTclient
  };

  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async createBleLink (gwid, timeout = gDefaultTimeout) {
    const self = this
    assert((timeout != null), 'timeout should not be null')
    assert(Number.isInteger(timeout), `timeout should be an integer: ${timeout}`)
    assert(timeout >= 0, `timeout should be a non-negative integer: ${timeout}`)

    const lgwid = gwid.toLowerCase()
    if (!(lgwid in this._GW)) {
      this._GW[lgwid] = new gateway.GapiLink(this, lgwid, timeout, this._MQTT5)

      debug({ log: null }, `[${lgwid}]:createBleLink :: Creating a new GAPI link with timeout: ${timeout}`)
      await this._GW[lgwid]._gwConnect()
      if (this._GWHBTList[lgwid]) {
        this._GWHBTList[lgwid].connected = true
      }
      process.nextTick(() => { self._GW[lgwid].emit('create', self._GW[lgwid]) })
    }
    return this._GW[lgwid]
  }

  mqttPublishAsync (...args) {
    const self = this
    return new Promise((resolve, reject) => {
      self._MQTTclient.publish(...args, (err, result) => {
        if (err) { reject(err) } else { resolve(result) }
      })
    })
  }

  mqttSubscribeAsync (...args) {
    const self = this
    return new Promise((resolve, reject) => {
      self._MQTTclient.subscribe(...args, (err, result) => {
        if (err) { reject(err) } else {
          resolve(result)
        }
      })
    })
  }

  mqttUnsubscribeAsync (...args) {
    const self = this
    return new Promise((resolve, reject) => {
      self._MQTTclient.unsubscribe(...args, (err, result) => {
        if (err) { reject(err) } else {
          resolve(result)
        }
      })
    })
  }

  mqttEndAsync (...args) {
    const self = this
    return new Promise((resolve, reject) => {
      self._MQTTclient.end(...args, (err, result) => {
        if (err) { reject(err) } else { resolve(result) }
      })
    })
  }
}

module.exports = {
  GapiClient: GapiClient
}
