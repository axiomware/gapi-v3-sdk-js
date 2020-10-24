/*
 * Netrunr GAPI V3 MQTT asynchronous API
 *
 * Copyright(C) 2020 Axiomware Systems Inc..
 *
 *  See LICENSE for more information
 */

'use strict'
const debuglib = require('debug')
const debug = debuglib('axm:gapi-ble-link')
const debugadv = debuglib('axm:gapi-ble-link:adv')
const debugmqtt = debuglib('axm:gapi-ble-link:mqtt')
const EventEmitter = require('events')

const AdvCachelib = require('./gapi-scan-cache-decoder.js')
const GAPIV3 = require('./gapi-v3-constants.js')
const GapiError = require('./gapi-error.js')

const gDefaultLinkTimeout = 1000 /* default additional timeout for network link in ms */

class GapiLink extends EventEmitter {
  constructor (clientObj, gwid, timeout, MQTTV5) {
    super() // event emitter
    this._advCache = new AdvCachelib.AdvCacheDecoder(200, 1, 2000)
    this._mqttObj = clientObj
    this._gwid = gwid
    this._gwConnectedState = false
    this._timeout = timeout
    this._MQTTV5 = MQTTV5
    this._iface_id = GAPIV3.IFACE_ID_GAPI
    this._reqTopic = null
    this._topics = {
      req: [],
      static: [],
      adv: [],
      dev: {}
    }
    this._dev = {}
    this._connParam = {
      interval_min: 20, /* x1.25ms */
      interval_max: 100, /* x1.25ms */
      latency: 0,
      timeout: 1000, /* x10ms */
      wait: 15
    }
    this._advListenFlag = false
    this._devListenFlag = {}
    this._q = {}
    this._ver = null
    this._advSubCount = 0
    this._mqttClid = this._mqttObj.clientID
    this._corrDataVal = new Uint32Array(1)
    this._corrDataVal[0] = 250
    this._defaultLinkTimeout = gDefaultLinkTimeout/* network link timeout in ms */
  }

  get clientID () {
    return this._mqttClid
  }

  get gwid () {
    return this._gwid
  }

  get info () {
    return this._ver
  }

  get defaultTimeout () {
    return this._timeout
  }

  set defaultTimeout (timeout) {
    this._timeout = timeout
  }

  get linkTimeout () {
    return this._defaultLinkTimeout
  }

  /**
     * @param {number} linkTimeout
     */
  set linkTimeout (linkTimeout) {
    this._defaultLinkTimeout = linkTimeout
  }

  get _corrData () {
    return this._corrDataVal[0]
  }

  set _corrData (cdata) {
    this._corrDataVal[0] = cdata
  }

  get scanListenFlag () {
    return this._advListenFlag
  }

  get connectionParameters () {
    return (Object.assign({}, this._connParam))
  }

  set connectionParameters (params) {
    this._connParam.interval_min = params.interval_min || this._connParam.interval_min
    this._connParam.interval_max = params.interval_max || this._connParam.interval_max
    this._connParam.latency = params.latency || this._connParam.latency
    this._connParam.timeout = params.timeout || this._connParam.timeout
    this._connParam.wait = params.wait || this._connParam.wait
  }

  async _dataHandler (mqttMatch, msgData, packet) {
    if ((mqttMatch.ch == 2) && (mqttMatch.addr.length > 0) && (mqttMatch.addr[0] == this.clientID)) {
      let cdata = 0
      let tmpBuf = this.getValue(['properties', 'correlationData'], packet) 
      if(tmpBuf){
      //if (packet.properties && packet.properties.correlationData) {
        //const buf1 = Buffer.from(packet.properties.correlationData)
        const buf1 = Buffer.from(tmpBuf)
        let L = buf1.length
        L = L > 4 ? 4 : L
        cdata = buf1.readUIntLE(0, L)
      } else {
        cdata = msgData['m'] || 0
      }

      debug({ log: msgData }, `[${mqttMatch.id}]:_dataHandler :: Ch: ${mqttMatch.ch} Cdata: ${cdata} addr: ${mqttMatch.addr[0]}`)
      if (this._q[cdata]) {
        if (this._q[cdata].timerID) {
          clearTimeout(this._q[cdata].timerID)
        }
        const endTime = new Date()
        const elapsedTime = endTime - this._q[cdata].stime
        const f = this._q[cdata].res
        await f({ payload: msgData, elapsedTime: elapsedTime })
        delete this._q[cdata]
      }
    } else if ((mqttMatch.ch == 3) && (mqttMatch.addr.length > 0) && (mqttMatch.addr[0] == 0)) {
      debugadv({ log: msgData }, `[${mqttMatch.id}]:_dataHandler :: Ch: ${mqttMatch.ch} addr: ${mqttMatch.addr[0]}`)
      this._gwAdvHandler(mqttMatch.id, msgData)
    } else if ((mqttMatch.ch == 4) && (mqttMatch.addr.length > 1)) {
      debug({ log: msgData }, `[${mqttMatch.id}]:_dataHandler :: Ch: ${mqttMatch.ch} addr: ${mqttMatch.addr[0]}`)
      if (this._dev[mqttMatch.addr[0]]) {
        this._dev[mqttMatch.addr[0]]._bleDataHandler(mqttMatch.addr[1], msgData)
      }
    } else if ((mqttMatch.ch == 5) && (mqttMatch.addr.length > 1)) {
      debug({ log: msgData }, `[${mqttMatch.id}]:_dataHandler :: Ch: ${mqttMatch.ch} addr: ${mqttMatch.addr[0]}`)
      if (this._dev[mqttMatch.addr[0]]) {
        this._dev[mqttMatch.addr[0]]._bleDataHandler(mqttMatch.addr[1], msgData)
      }
    } else if ((mqttMatch.ch == 7) && (mqttMatch.addr.length > 0) && (mqttMatch.addr[0] == 0)) {
      debug({ log: msgData }, `[${mqttMatch.id}]:_dataHandler :: Ch: ${mqttMatch.ch} addr: ${mqttMatch.addr[0]}`)
      this._gwScanEvtHandler(mqttMatch.id, msgData)
    } else {
      debug({ log: msgData }, `[${mqttMatch.id}]:_dataHandler :: unknown message Ch: ${mqttMatch.ch} addr: ${mqttMatch.addr[0]}`)
    }
  }

  getValue = (keyList, iObj) => keyList.reduce((rObj, key) => (rObj && rObj[key]) ? rObj[key] : null, iObj)

  _gwAdvHandler (gwid, advData) {
    const madv = {
      nodes: [],
      result: GAPIV3.GAPI_SUCCESS,
      subcode: 0,
      report: 1
    }
    advData.forEach((adv) => {
      const cret = this._advCache.decode(adv)
      madv.nodes.push(cret)
    })
    this.emit('adv', this, gwid, madv)
  }

  _gwScanEvtHandler (gwid, scanEvtData) {
    const pc = this._advSubCount
    const scnData = {
      event: scanEvtData.event,
      id: scanEvtData.id,
      clid: scanEvtData.clid,
      c: scanEvtData.c,
      broadcast: scanEvtData.broadcast,
      period: scanEvtData.period,
      start: scanEvtData.start,
      result: scanEvtData.result,
      subcode: scanEvtData.subcode,
      t: scanEvtData.tss + scanEvtData.tsus * 1e-6
    }
    if ((scanEvtData.event == GAPIV3.GAPI_EVENT_SCAN_STATE_CHANGE) &&
            (scanEvtData.clid == this.clientID) &&
            (scanEvtData.c == GAPIV3.C.GAPI_SCAN_START_V3)) {
      if (scanEvtData.start && scanEvtData.broadcast) {
        this._advSubCount++
      } else {
        this._advSubCount = this._advSubCount > 0 ? this._advSubCount - 1 : this._advSubCount
      }
    }

    if ((scanEvtData.event == GAPIV3.GAPI_EVENT_SCAN_STATE_CHANGE) && (scanEvtData.c == GAPIV3.C.GAPI_SCAN_STOP_V3)) {
      this._advSubCount = 0
    }
    if ((pc == 0) && (this._advSubCount > 0)) {
      this._gwConnectAdv(true)
    } else if ((pc > 0) && (this._advSubCount == 0)) {
      this._gwConnectAdv(false)
    }
    this.emit('event:scan', this, gwid, scnData)
  }

  async _gwConnect () {
    if (!this._gwConnectedState) {
      this._gwConnectedState = true
      const tstr = `${this._mqttObj._topicPrefix}${this._gwid}/${this._iface_id}/`

      this._reqTopic = `${tstr}1/0`

      this._topics.req = [`${tstr}1/0`]
      this._topics.static = [`${tstr}2/${this.clientID}`, `${tstr}6/0`, `${tstr}7/0`]
      this._topics.adv = [`${tstr}3/0`]

      try {
        await this._mqttObj.mqttSubscribeAsync(this._topics.static, { nl: true })
        debug({ log: null }, `[${this.clientID}]:onConnectHandler :: subscribing to topics: ${this._topics.static}`)
        const vret = await this.version(this._timeout)
        this._ver = vret
        return true
      } catch (err) {
        this._gwConnectedState = false
        console.log(err)
        throw Error(err)
      }
    } else {
      debug({ log: null }, `[${this._gwid}]:_gwConnect :: Already connected`)
    }
    return true
  }

  async _gwConnectAdv (connectFlag) {
    if (this._gwConnectedState) {
      try {
        if (connectFlag || this._advListenFlag) {
          await this._mqttObj.mqttSubscribeAsync(this._topics.adv, { nl: true })
          debug({ log: null }, `[${this._gwid}]:_gwConnectAdv :: subscribing to topics: ${this._topics.adv}`)
          return true
        } else {
          await this._mqttObj.mqttUnsubscribeAsync(this._topics.adv)

          debug({ log: null }, `[${this._gwid}]:_gwConnectAdv :: unsubscribing to topics: ${this._topics.adv}`)
          return true
        }
      } catch (err) {
        throw Error(err)
      }
    } else {
      debug({ log: null }, `[${this._gwid}]:_gwConnectAdv :: Not connected`)
    }
    return true
  }

  async _gwConnectBleDevice (node, handle, notificationFlag, connectFlag) {
    if (this._gwConnectedState) {
      const ch = notificationFlag ? '4' : '5'

      const topicStr = `${this._mqttObj._topicPrefix}${this._gwid}/${this._iface_id}/${ch}/${node}/${handle}`
      try {
        if (connectFlag || this._devListenFlag[node]) {
          this._topics.dev[node] = this._topics.dev[node] || {}
          this._topics.dev[node][handle] = [topicStr]
          await this._mqttObj.mqttSubscribeAsync(this._topics.dev[node][handle], { nl: true })
          debug({ log: null }, `[${this._gwid}]:_gwConnectBleDevice :: subscribing to topics: ${this._topics.dev[node][handle]}`)

          return true
        } else {
          if (this._topics.dev[node] && this._topics.dev[node][handle]) {
            await this._mqttObj.mqttUnsubscribeAsync(this._topics.dev[node][handle])
            debug({ log: null }, `[${this._gwid}]:_gwConnectBleDevice :: unsubscribing to topics: ${this._topics.dev[node][handle]}`)
            delete this._topics.dev[node][handle]
            if (Object.keys(this._topics.dev[node]).length === 0) {
              delete this._topics.dev[node]
            }
            return true
          }
        }
      } catch (err) {
        throw Error(err)
      }
    } else {
      debug({ log: null }, `[${this._gwid}]:_gwConnectBleDevice :: Not connected`)
    }
    return true
  }

  async _gwSubscribeTopicBleDevice (node, handle, notificationFlag) {
    if (this._gwConnectedState) {
      const ch = notificationFlag ? '4' : '5'
      const topicStr = `${this._mqttObj._topicPrefix}${this._gwid}/${this._iface_id}/${ch}/${node}/${handle}`
      this._topics.dev[node] = this._topics.dev[node] || {}
      this._topics.dev[node][handle] = [topicStr]
      await this._mqttObj.mqttSubscribeAsync(this._topics.dev[node][handle], { nl: true })
      debug({ log: null }, `[${this._gwid}]:_gwSubscribeTopicBleDevice :: subscribing to topics: ${this._topics.dev[node][handle]}`)
    } else {
      debug({ log: null }, `[${this._gwid}]:_gwSubscribeTopicBleDevice :: Not connected`)
    }
    return true
  }

  async _gwUnsubscribeTopicBleDevice (node, handle) {
    const topicArray = []

    if (node == '' || node == null) { // unsubscribe from all nodes and topics
      for (const node in this._topics.dev) {
        for (const handle in this._topics.dev[node]) {
          this._topics.dev[node][handle].forEach((topic) => { topicArray.push(topic) })
          delete this._topics.dev[node][handle]
        }
        delete this._topics.dev[node]
      }
    } else if (handle == '' || handle == null) {
      if (this._topics.dev[node]) {
        for (const handle in this._topics.dev[node]) {
          this._topics.dev[node][handle].forEach((topic) => { topicArray.push(topic) })
          delete this._topics.dev[node][handle]
        }
        delete this._topics.dev[node]
      }
    } else if (this._topics.dev[node] && this._topics.dev[node][handle]) {
      this._topics.dev[node][handle].forEach((topic) => { topicArray.push(topic) })
      delete this._topics.dev[node][handle]
      if (Object.keys(this._topics.dev[node]).length === 0) {
        delete this._topics.dev[node]
      }
    }
    if (topicArray.length > 0) {
      await this._mqttObj.mqttUnsubscribeAsync(topicArray)
      debug({ log: null }, `[${this._gwid}]:_gwUnsubscribeTopicBleDevice :: unsubscribing to topics: ${topicArray}`)
    }
    return true
  }

  _genCorrData () {
    this._corrData = this._corrData > 10000000 ? 0 : this._corrData + 1
    if (this._q[this._corrData]) {
      debug({ log: null }, `[${this._gwid}]:_genCorrData :: retry after collision with corr data: ${this._corrData}`)
      this._genCorrData()
    } else {
      debug({ log: null }, `[${this._gwid}]:_genCorrData ::  new corr data: ${this._corrData}`)
      return this._corrData
    }
  }

  async _timeoutHandler (cdata, timeout) {
    debug({ log: null }, `[${this._gwid}]:_timeoutHandler ::  timeout completed - timeout: ${timeout} cdata: ${this._corrData}`)
    if (this._q[cdata]) {
      const f = this._q[cdata].tmo
      await f()
    }
  }

  async _enqueueRequest (resolve, reject, obj) {
    const cdata = this._genCorrData()

    const fullTimeout = obj.tmo + this.linkTimeout

    if(!this._MQTTV5){
      obj['r'] = `${this.clientID}`
      obj['m'] = cdata
    }

    this._q[cdata] = {
      res: rObj => { (rObj.payload.result == GAPIV3.GAPI_SUCCESS) ? resolve(rObj) : reject(new GapiError(`gw error for ${JSON.stringify(obj)}`, JSON.stringify(rObj), rObj.payload.result, rObj.payload.subcode)) }, // response handler
      evt: rObj => { reject(new GapiError(`evt error for ${JSON.stringify(obj)}`, JSON.stringify(rObj), rObj.payload.result, rObj.payload.subcode || 0)) }, // event handler
      tmo: rObj => { reject(new GapiError(`Time out error after ${fullTimeout} ms for ${JSON.stringify(obj)}`, 'Timeout', 408, 0)) }, // timeout handler
      timeoutInMilliseconds: fullTimeout,
      timerID: null,
      stime: new Date(),
      req: JSON.stringify(obj) // request
    }
    try {
      const lbuf = Buffer.alloc(4)

      lbuf.writeUInt32LE(cdata, 0)
      this._q[cdata].timerID = setTimeout(() => { this._timeoutHandler(cdata, fullTimeout) }, fullTimeout)
      if(this._MQTTV5){
        await this._mqttObj.mqttPublishAsync(this._reqTopic, this._q[cdata].req, { qos: 0, properties: { responseTopic: `${this.clientID}`, correlationData: lbuf } })
        debug({ log: obj }, `[${this._gwid}]:_enqueueRequest ::  Published MQTTV5 request with cdata: ${cdata}`)
      } else {
        await this._mqttObj.mqttPublishAsync(this._reqTopic, this._q[cdata].req, { qos: 0 })
        debug({ log: obj }, `[${this._gwid}]:_enqueueRequest ::  Published MQTTV4 request with cdata: ${cdata}`)
      }
    } catch (err) {
      throw Error(err)
    }
  }

  _gRequestResponse (obj) {
    const self = this
    debug({ log: obj }, `[${this._gwid}]:_gRequestResponse ::  Adding to Request queue with timeout: ${obj.tmo}`)
    return new Promise((resolve, reject) => {
      if (!self._gwConnectedState) { // AG: check if iface exists
        reject(new GapiError('No connection to gateway', '', 408, 0))
      }
      this._enqueueRequest(resolve, reject, obj)
    })
  };

  async version (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_VERSION_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      version: vret.payload.version,
      build: vret.payload.build,
      system: vret.payload.system,
      hardware: vret.payload.hardware,
      ram: vret.payload.ram,
      hci: vret.payload.hci,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async show (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_SHOW_CONNECTIONS_V3
    pclone.tmo = timeoutInMilliseconds
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      nodes: vret.payload.nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async showConnectionDetails (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_SHOW_CONNECTION_DETAILS_V3
    pclone.tmo = timeoutInMilliseconds
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      nodes: vret.payload.nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async setAdvTiming (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_ADVERTISEMENT_CONFIG_TIMIG_V3
    pclone.tmo = timeoutInMilliseconds
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async setAdvData (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_ADVERTISEMENT_CONFIG_DATA_V3
    pclone.tmo = timeoutInMilliseconds
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async advStart (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_ADVERTISEMENT_START_V3,
      tmo: timeoutInMilliseconds
    }

    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async advStop (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_ADVERTISEMENT_STOP_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async getAdvStatus (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_ADVERTISEMENT_STATUS_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime,
      enable: vret.payload.enable,
      timing: vret.payload.timing,
      data: vret.payload.data,
      clid: vret.payload.clid
    }
    return (ret)
  }

  async getAdvInitialState (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_ADVERTISEMENT_GET_INIT_STATE_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime,
      enable: vret.payload.enable,
      timing: vret.payload.timing,
      data: vret.payload.data
    }
    return (ret)
  }

  async setAdvInitialState (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_ADVERTISEMENT_SET_INIT_STATE_V3
    pclone.tmo = timeoutInMilliseconds
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanListen (Listenflag) {
    const F = !!Listenflag
    this._advListenFlag = F
    await this._gwConnectAdv(F)
    return (this._advListenFlag)
  }

  async scanStart (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_SCAN_START_V3
    pclone.tmo = timeoutInMilliseconds
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      id: vret.payload.id,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanCancel (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_SCAN_CANCEL_V3
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gRequestResponse(pclone)
    const ret = {
      op: vret.payload.op,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanStop (timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_STOP_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanPause (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_SCAN_PAUSE_V3
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gRequestResponse(pclone)
    const ret = {
      id: vret.payload.id,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanResume (timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_RESUME_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanStatus (timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_STATUS_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      state: vret.payload.state,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanCacheEnable (timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_CACHE_ENABLE_V3,
      enable: true,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanCacheDisable (timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_CACHE_ENABLE_V3,
      enable: false,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanCacheLength (timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_CACHE_GET_LENGTH_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      length: vret.payload.length,
      uniqueLength: vret.payload.uniqueLength,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanCacheClear (timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_CACHE_CLEAR_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async scanCacheRead (mode = 1, timeoutInMilliseconds = this._timeout) {
    const pobj = {
      c: GAPIV3.C.GAPI_SCAN_CACHE_READ_V3,
      mode: mode, // 0-> all, 1-> unique 2-> unique connectable
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const nodes = []
    vret.payload.nodes.forEach((adv) => {
      const r = this._advCache.decode(adv)
      if (r) {
        nodes.push(r)
      }
    })
    const ret = {
      nodes: nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pobj.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async getScanCacheParameters (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_SCAN_CACHE_GET_PARAMETERS_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime,
      cache: vret.payload.cache
    }
    return (ret)
  }

  async setScanCacheParameters (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_SCAN_CACHE_SET_PARAMETERS_V3
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async getScanInitialState (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_SCAN_GET_INITIAL_STATE_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime,
      enable: vret.payload.enable,
      parameters: vret.payload.parameters,
      cache: vret.payload.cache
    }
    return (ret)
  }

  async setScanInitialState (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_SCAN_SET_INITIAL_STATE_V3
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gRequestResponse(pclone)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  scanLocalCacheRead () {
    const ret = {
      nodes: this._advCache.readQueue()
    }
    return (ret)
  }

  scanLocalCacheLength () {
    return (this._advCache.length)
  }

  scanLocalCacheClear () {
    this._advCache.clear()
  }

  getScanLocalCacheTTL () {
    return (this._advCache.TTL)
  }

  setScanLocalCacheTTL (TTL) {
    this._advCache.TTL = TTL
  }

  async connect (node, params, timeoutInMilliseconds = this._timeout) {
    const tmp = Object.assign({}, node, params)
    const pclone = {
      c: GAPIV3.C.GAPI_CONNECT_V3,
      node: tmp.node.toLowerCase(),
      dtype: tmp.dtype,
      ev: tmp.ev || '',
      adv: tmp.adv || '',
      rsp: tmp.rsp || '',
      interval_min: tmp.interval_min || this._connParam.interval_min,
      interval_max: tmp.interval_max || this._connParam.interval_max,
      latency: tmp.latency || this._connParam.latency,
      timeout: tmp.timeout || this._connParam.timeout,
      wait: tmp.wait || this._connParam.wait,
      tmo: timeoutInMilliseconds
    }

    const vret = await this._gRequestResponse(pclone)
    if (!(vret.payload.node in this._dev)) {
      this._dev[vret.payload.node] = new BleDevice(this, pclone, vret, timeoutInMilliseconds)
    } else {
      this._dev[vret.payload.node].result = vret.payload.result
      this._dev[vret.payload.node].subcode = vret.payload.subcode
      this._dev[vret.payload.node].m = vret.payload.m
      this._dev[vret.payload.node].t = vret.payload.tss + vret.payload.tsus * 1e-6
      this._dev[vret.payload.node].rtt = vret.elapsedTime
    }
    return (this._dev[vret.payload.node])
  }

  async disconnectAll (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_DISCONNECT_ALL_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      nodes: vret.payload.nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    await this._gwUnsubscribeTopicBleDevice('', '')
    return (ret)
  }

  async disconnectNode (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_DISCONNECT_NODE_V3
    pclone.tmo = timeoutInMilliseconds
    const vret = await this._gRequestResponse(pclone)
    const ret = {
      nodes: vret.payload.nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    await this._gwUnsubscribeTopicBleDevice(pclone.node, '')
    return (ret)
  }

  async listpair (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_LIST_PAIR_V3
    pclone.node = 'aaaaaaaaaaaa'//'e7042d9ffd90'
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gRequestResponse(pclone)
    const ret = {
      nodes: vret.payload.nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async unpair (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_DELETE_PAIR_V3
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async ping (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_PING_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      gwid: vret.payload.gwid,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async pingDelay (delayInMtimeoutInMilliseconds, timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_PING_DELAY_V3,
      delay: delayInMtimeoutInMilliseconds,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      gwid: vret.payload.gwid,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async execQueueStatus (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_EXEC_QUEUE_STATUS_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      status: vret.payload.status,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async execQueueList (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_EXEC_QUEUE_LIST_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      list: vret.payload.gwid,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async execQueueFlush (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_EXEC_QUEUE_FLUSH_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async execQueueStop (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_EXEC_QUEUE_STOP_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async execQueueContinue (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_EXEC_QUEUE_CONTINUE_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async execQueueRunOnce (timeoutInMilliseconds = this._timeout) {
    var pobj = {
      c: GAPIV3.C.GAPI_EXEC_QUEUE_RUN_ONCE_V3,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gRequestResponse(pobj)
    const ret = {
      cmd: vret.payload.cmd,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }
}

class BleDevice extends EventEmitter {
  constructor (gapiObj, nodeInfo, ret, timeoutInMilliseconds) {
    super() // event emitter
    this.result = ret.payload.result
    this.subcode = ret.payload.subcode
    this.m = ret.payload.m
    this.t = ret.payload.tss + ret.payload.tsus * 1e-6
    this.rtt = ret.elapsedTime
    this._gapiLinkObj = gapiObj
    this._topics = {}
    this._cbHandlers = {}
    this._nodeInfo = {
      node: nodeInfo.node,
      dtype: nodeInfo.dtype,
      ev: nodeInfo.ev || '',
      adv: nodeInfo.adv || '',
      rsp: nodeInfo.rsp || ''
    }
    this._connParam = {
      interval_min: nodeInfo.interval_min,
      interval_max: nodeInfo.interval_max,
      latency: nodeInfo.latency,
      timeout: nodeInfo.timeout,
      wait: nodeInfo.wait
    }
    this._timeout = timeoutInMilliseconds
    this._connected = true
  }

  get node () {
    return (this._nodeInfo.node)
  }

  get clientID () {
    return this._gapiLinkObj._mqttClid
  }

  get gwid () {
    return this._gapiLinkObj._gwid
  }

  get info () {
    return this._gapiLinkObj._ver
  }

  get defaultTimeout () {
    return this._gapiLinkObj._timeout
  }

  set defaultTimeout (timeout) {
    this._gapiLinkObj._timeout = timeout
  }

  get linkTimeout () {
    return this._defaultLinkTimeout
  }

  get connectionParameters () {
    return (Object.assign({}, this._connParam))
  }

  set connectionParameters (params) {
    this._connParam.interval_min = params.interval_min || this._connParam.interval_min
    this._connParam.interval_max = params.interval_max || this._connParam.interval_max
    this._connParam.latency = params.latency || this._connParam.latency
    this._connParam.timeout = params.timeout || this._connParam.timeout
    this._connParam.wait = params.wait || this._connParam.wait
  }

  _bleDataHandler (handle, msgData) {
    const data = {
      c: msgData.c,
      m: msgData.m,
      report: msgData.report,
      gwid: this.gwid,
      node: msgData.node,
      sh: msgData.sh,
      value: msgData.value,
      t: msgData.tss + msgData.tsus * 1e-6,
      result: msgData.result,
      subcode: msgData.subcode
    }
    const e = `data:${handle}`
    if (this._cbHandlers[handle] && ((typeof this._cbHandlers[handle]) === 'function')) {
      this._cbHandlers[handle](this, data)
    }
    this.emit(e, this, data)
  }

  async _gwSubscribeTopicBleDeviceLoc (handle, handler, notificationFlag) {
    const gwObj = this._gapiLinkObj
    const node = this._nodeInfo.node
    const ch = notificationFlag ? '4' : '5'
    const topicStr4 = `${gwObj._mqttObj._topicPrefix}${gwObj._gwid}/${gwObj._iface_id}/4/${node}/${handle}`
    const topicStr5 = `${gwObj._mqttObj._topicPrefix}${gwObj._gwid}/${gwObj._iface_id}/5/${node}/${handle}`
    this._topics[handle] = [topicStr4, topicStr5]
    if (typeof handler === 'function') {
      this._cbHandlers[handle] = handler
    }
    await gwObj._mqttObj.mqttSubscribeAsync(this._topics[handle], { nl: true })
    debug({ log: null }, `[${gwObj._gwid}]:_gwSubscribeTopicBleDeviceLoc :: subscribing to topics: ${this._topics[handle]}`)
    return true
  }

  async _gwUnsubscribeTopicBleDeviceLoc (handle) {
    const gwObj = this._gapiLinkObj
    const topicArray = []
    if (handle == '' || handle == null) {
      for (const hdl in this._topics) {
        topicArray.push(this._topics[hdl][0])
        delete this._topics[hdl]
      }
    } else if (this._topics[handle]) {
      topicArray.push(this._topics[handle][0])
      delete this._topics[handle]
    }
    if (topicArray.length > 0) {
      await gwObj._mqttObj.mqttUnsubscribeAsync(topicArray)
      debug({ log: null }, `[${gwObj._gwid}]:_gwUnsubscribeTopicBleDeviceLoc :: unsubscribing to topics: ${topicArray}`)
    }
    return true
  }

  async reconnect (params, timeoutInMilliseconds = this._timeout) {
    const tmp = Object.assign({}, params)
    const pclone = {
      c: GAPIV3.C.GAPI_CONNECT_V3,
      node: this.node,
      dtype: this._nodeInfo.dtype,
      interval_min: tmp.interval_min || this._connParam.interval_min,
      interval_max: tmp.interval_max || this._connParam.interval_max,
      latency: tmp.latency || this._connParam.latency,
      timeout: tmp.timeout || this._connParam.timeout,
      wait: tmp.wait || this._connParam.wait,
      tmo: timeoutInMilliseconds
    }

    const vret = await this._gapiLinkObj._gRequestResponse(pclone)

    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }

    this._connParam.interval_min = tmp.interval_min || this._connParam.interval_min
    this._connParam.interval_max = tmp.interval_max || this._connParam.interval_max
    this._connParam.latency = tmp.latency || this._connParam.latency
    this._connParam.timeout = tmp.timeout || this._connParam.timeout
    this._connParam.wait = tmp.wait || this._connParam.wait
    this.result = ret.result
    this.subcode = ret.subcode
    this.m = ret.m
    this.t = ret.t
    this.rtt = ret.rtt
    return (ret)
  }

  async disconnect (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_DISCONNECT_NODE_V3,
      node: this.node,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      nodes: vret.payload.nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    await this._gwUnsubscribeTopicBleDeviceLoc('')
    return (ret)
  }

  async services (timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_SERVICES_ALL_V3,
      node: this.node,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      services: vret.payload.services,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async servicesByUUID (uuidHexStr, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_SERVICES_V3,
      node: this.node,
      uuid: uuidHexStr,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      services: vret.payload.services,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async characteristics (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_CHARACTERISTICS_V3,
      node: this.node,
      sh: params.sh,
      eh: params.eh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      characteristics: vret.payload.characteristics,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async descriptors (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_DESCRIPTORS_V3,
      node: this.node,
      sh: params.sh,
      eh: params.eh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      descriptors: vret.payload.descriptors,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async subscribeIndicationDirect (params, handler = null, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_DESCRIPTOR_V3,
      node: this.node,
      sh: params.sh,
      value: '0200', // write indication in bit field 1
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: GAPIV3.C.GAPI_SUBSCRIBE_INDICATE_DIRECT_V3,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    if (vret.payload.result == GAPIV3.GAPI_SUCCESS) {
      await this._gwSubscribeTopicBleDeviceLoc(params.csh, handler, false)
    }
    return (ret)
  }

  async unsubscribeIndicationDirect (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_DESCRIPTOR_V3,
      node: this.node,
      sh: params.sh,
      value: '0000', // write indication in bit field 1
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: GAPIV3.C.GAPI_UNSUBSCRIBE_INDICATE_DIRECT_V3,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    await this._gwUnsubscribeTopicBleDeviceLoc(params.csh)
    return (ret)
  }

  async subscribeNotificationDirect (params, handler = null, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_DESCRIPTOR_V3,
      node: this.node,
      sh: params.sh,
      value: '0100', // write indication in bit field 0
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: GAPIV3.C.GAPI_SUBSCRIBE_NOTIFY_DIRECT_V3,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    if (vret.payload.result == GAPIV3.GAPI_SUCCESS) {
      await this._gwSubscribeTopicBleDeviceLoc(params.csh, handler, true)
    }
    return (ret)
  }

  async unsubscribeNotificationDirect (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_DESCRIPTOR_V3,
      node: this.node,
      sh: params.sh,
      value: '0000', // write indication in bit field 0
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: GAPIV3.C.GAPI_UNSUBSCRIBE_NOTIFY_DIRECT_V3,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    await this._gwUnsubscribeTopicBleDeviceLoc(params.csh)
    return (ret)
  }

  async subscribeIndication (params, handler = null, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_SUBSCRIBE_INDICATE_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    if (vret.payload.result == GAPIV3.GAPI_SUCCESS) {
      await this._gwSubscribeTopicBleDeviceLoc(pclone.sh, handler, false)
    }
    return (ret)
  }

  async unsubscribeIndication (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_UNSUBSCRIBE_INDICATE_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    await this._gwUnsubscribeTopicBleDeviceLoc(pclone.sh)
    return (ret)
  }

  async subscribeNotification (params, handler = null, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_SUBSCRIBE_NOTIFY_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    if (vret.payload.result == GAPIV3.GAPI_SUCCESS) {
      await this._gwSubscribeTopicBleDeviceLoc(pclone.sh, handler, true)
    }
    return (ret)
  }

  async unsubscribeNotification (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_UNSUBSCRIBE_NOTIFY_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    await this._gwUnsubscribeTopicBleDeviceLoc(pclone.sh)
    return (ret)
  }

  async pair (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_CREATE_PAIR_V3
    pclone.node = this.node
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async unpair (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_DELETE_PAIR_V3
    pclone.node = this.node
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async listpair (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_LIST_PAIR_V3
    pclone.node = this.node
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      nodes: vret.payload.nodes,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: vret.payload.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async setPairKey (params, timeoutInMilliseconds = this._timeout) {
    const pclone = Object.assign({}, params)
    pclone.c = GAPIV3.C.GAPI_PAIR_KEY_V3
    pclone.node = this.node
    pclone.tmo = timeoutInMilliseconds

    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async read (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_READ_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      value: vret.payload.value,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async readlong (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_READ_LONG_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      value: vret.payload.value,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async write (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_V3,
      node: this.node,
      sh: params.sh,
      value: params.value,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async writelong (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_LONG_V3,
      node: this.node,
      sh: params.sh,
      value: params.value,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async writenoresponse (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_NORESPONSE_V3,
      node: this.node,
      sh: params.sh,
      value: params.value,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async readDescriptor (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_READ_DESCRIPTOR_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      value: vret.payload.value,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async readDescriptorlong (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_READ_DESCRIPTOR_LONG_V3,
      node: this.node,
      sh: params.sh,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      value: vret.payload.value,
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async writeDescriptor (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_DESCRIPTOR_V3,
      node: this.node,
      sh: params.sh,
      value: params.value,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }

  async writeDescriptorlong (params, timeoutInMilliseconds = this._timeout) {
    const pclone = {
      c: GAPIV3.C.GAPI_WRITE_DESCRIPTOR_LONG_V3,
      node: this.node,
      sh: params.sh,
      value: params.value,
      tmo: timeoutInMilliseconds
    }
    const vret = await this._gapiLinkObj._gRequestResponse(pclone)
    const ret = {
      node: vret.payload.node,
      t: vret.payload.tss + vret.payload.tsus * 1e-6,
      c: pclone.c,
      m: vret.payload.m,
      result: vret.payload.result,
      subcode: vret.payload.subcode,
      rtt: vret.elapsedTime
    }
    return (ret)
  }
}

module.exports = {
  GapiLink: GapiLink
}
