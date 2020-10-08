# Netrunr Bluetooth advertisement scanner example

Collect Bluetooth advertisement data from [Axiomware's](http://www.axiomware.com) Netrunr gateways using [gapi-v3-sdk](https://github.com/axiomware/gapi-v3-sdk-js.git) JavaScript SDK

This Program will illustrate the following basic API functions:
- Install and include the SDK in a NodeJS Program.
- Connect to a MQTT broker and collect heartbeat data.
- Connect to multiple Netrunr gateways and initiate scan process.
- Manage data collection from multiple concurrent sources using event handlers.
- Verify the configuration of the gateway and MQTT broker.

**This example uses promises and async/await functionality present in Nodejs version 8.+**.

## SDK, Documentation and examples
- [Netrunr Gateway API V3 Documentation](http://www.axiomware.com/apidocs/index.html)
- [Netrunr Gateway API V3 SDK](https://github.com/axiomware/gapi-v3-sdk-js.git)

## Requirements

- [Netrunr E24](https://www.axiomware.com/netrunr-e24-product/) gateway
- Nodejs (see [https://nodejs.org/en/](https://nodejs.org/en/) for download and installation instructions)
  - Nodejs version 8.x.x or higher is required due to the use of promises/async/await
- NPM (Node package manager - part of Nodejs)   
- Windows, MacOS or Linux computer with access to internet

## Installation

Clone the repo

`git clone https://github.com/axiomware/gapi-v3-sdk-js.git`

or download as zip file to a local directory and unzip.

Install all module dependencies by running the following command inside the directory

```bash
cd gapi-v3-sdk-js/examples/netrunr-adv-scanner-v3

npm install
```

## Optional customization before running the program
This example uses the default setup of the Netrunr gateway:
- The client computer is connected to the LAN port of Netrunr gateway
- The built-in MQTT broker is used and the IP address of the gateway is `192.168.8.1`
- The MQTT broker port is `1883`
- The MQTT topic prefix is `netrunrfe`

## Usage

Run the nodejs application to collect advertisements for 10 seconds:

`node netrunr-adv-scanner.js -h '192.168.8.1' -p 1883 -t 'netrunrfe' --period=10`

To force exit at any time, use:

`CTRL-C`  

## Error conditions/Troubleshooting

- If the program fails with module not installed, make sure `npm Install` is run prior to connecting to Netrunr gateway.
- For security reasons, Clients connected to LAN ports of Netrunr gateway have limited access to upstream network.
- If you do not see any heartbeat activity, verify network connections and your configuration.
