
/*
 * Example program - Detect Netrunr Heart beat signal
 *
 * Copyright(C) 2020 Axiomware Systems Inc..
 * https://www.axiomware.com/
 *
 * Licensed under the MIT license <LICENSE-MIT or http://opensource.org/licenses/MIT>
 */

const GapiV3Lib = require('gapi-v3-sdk')

const minimist = require('minimist')

const args = minimist(process.argv.slice(2), {
  string: ['host', // MQTT broker IP addr
    'port', // MQTT broker port
    'prefix'], // Topic prefix
  alias: { h: 'host', p: 'port', t: 'prefix' },
  default: {
    host: '192.168.8.1',
    port: '1883',
    prefix: 'netrunrfe/'
  }
})

const host = args.host
const port = args.port
const topic = args.prefix
var MQTToptions = {
  username: '',
  password: ''
}

const gNetrunrClient = new GapiV3Lib.GapiClient() // One instance needed to manage all
// gateways connected to a MQTT broker

main()

async function main () {
  gNetrunrClient.on('heartbeat', gwHeartbeatHandler)
  await gNetrunrClient.init(host, port, MQTToptions, topic)
}

async function gwHeartbeatHandler (hbtData) {
  console.log(hbtData)
}
