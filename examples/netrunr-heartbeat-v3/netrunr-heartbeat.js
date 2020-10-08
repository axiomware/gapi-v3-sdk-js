
/*
 * Example program - Detect Netrunr Heart beat signal
 *
 * Copyright(C) 2020 Axiomware Systems Inc..
 * https://www.axiomware.com/
 * 
 * Licensed under the MIT license <LICENSE-MIT or http://opensource.org/licenses/MIT>
 */

const gapiV3Lib = require("gapi-v3-sdk");

const minimist = require('minimist');


let args = minimist(process.argv.slice(2), {
    string: ['host'],//MQTT broker IP addr
    string: ['port'],//MQTT broker port
    string: ['prefix'],//Topic prefix
    alias: { h: 'host', p: 'port', t: 'prefix'},
    default: {
        'host': '192.168.8.1',
        'port': '1883', 
        'prefix': 'netrunrfe/'
    }
})

let host = args['host']
let port = args['port']
let topic = args['prefix']
var MQTToptions = {
    username: "",
    password: ""
};

const gNetrunrClient = new gapiV3Lib.gapiClient();  // One instance needed to manage all 
                                                    // gateways connected to a MQTT broker

main();

async function main(){
    gNetrunrClient.on('heartbeat', gwHeartbeatHandler);
    var gClient = await gNetrunrClient.init(host, port, MQTToptions, topic);
}

async function gwHeartbeatHandler(hbtData){
    console.log(hbtData)
}

