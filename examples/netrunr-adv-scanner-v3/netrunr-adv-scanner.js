
/*
 * Example program - Setup Netrunr gateways to collect Bluetooth LE advertisements
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
    string: ['period'],//scan period in seconds, must be positive integer
    alias: { h: 'host', p: 'port', t: 'prefix', s:'period'},
    default: {
        'host': '192.168.8.1',
        'port': '1883', 
        'prefix': 'netrunrfe/',
        'period': 5
    }
})

let host = args['host']
let port = args['port']
let topic = args['prefix']
let period = args['period']
var MQTToptions = {
    username: "",
    password: ""
};

console.log(args)

const gNetrunrClient = new gapiV3Lib.gapiClient();  // One instance needed to manage all 
                                                    // gateways connected to a MQTT broker

main();

//main process
async function main(){
    gNetrunrClient.on('heartbeat', gwHeartbeatHandler);
    var gClient = await gNetrunrClient.init(host, port, MQTToptions, topic);
}

//Connect to every gateway with heartbeat signal and initiate scan process
async function gwHeartbeatHandler(hbtData){
    console.log(`[${hbtData.id}][${hbtData.date}][${hbtData.rcount}]`)
    if(!gNetrunrClient.getBleLinkStatus(hbtData.id)){
        let gwHandle = await gNetrunrClient.createBleLink(hbtData.id)
        console.log(`[${gwHandle.gwid}][${JSON.stringify(gwHandle.info)}]`)        
        gwHandle.on('create', bleLinkHandler);
        gwHandle.on('adv', bleAdvHandler);
        gwHandle.on('event:scan', bleScanEventHandler);
    }
}

//on connect to a gateway, start scan
async function bleLinkHandler(linkHandle){
    let ret = await linkHandle.scanStart({active: false, period: period, filter: 2, broadcast: true }, 5000);
    console.log(`[${linkHandle.gwid}][Scan start]`) 
}

//advertisement handler
async function bleAdvHandler(linkHandle, gwid, advData){
    console.log(advData)
}

//scan event handler
async function bleScanEventHandler(linkHandle, gwid, scanEventData){
    console.log(`[${gwid}][${JSON.stringify(scanEventData)}]`)
}


