/*
 * Simple BLE advertisement store with TTL
 *
 * Copyright(C) 2020 Axiomware Systems Inc..
 */

'use strict'
const debuglib = require('debug');
const debug = debuglib('axm:gapi-scan-cache-decoder');
const debugtrace = debuglib('axm:gapi-scan-cache-decoder:trace');


class advCacheDecoder
{ 
	constructor(TTL=200, checkperiod=5) //time in seconds
	{ 
        this._TTL = TTL;
        this._checkperiod = checkperiod;
        this._hashList = {};
        this._hashListLength = 0;
        this._gcTimerID = setInterval(()=> {this._gcCleaner()}, 1000*this._checkperiod);
    }

    get length() {
        return this._hashListLength;
    }

    get TTL() {
        return this._TTL;
    }

    set TTL(ttl) {
        let ttl_fix = ttl.toFixed(0)
        if(ttl_fix > 0) {
            this._TTL = ttl_fix;
        }
    }

    //check if cache hit
    decode(advIn) 
    {	
        let adv = this.deepCopy(advIn)
        let h = adv['hash'];
        let ret = null;
        if('node' in adv) {//full adv
            ret = Object.assign({}, adv)
            if(!(h in this._hashList)) {
                this._hashList[h] = {adv: Object.assign({}, adv), t: Date.now()}
                this._hashListLength++;
            } else {
                this._hashList[h].t = Date.now()
            }
        } else {
            if(h in this._hashList) {
                this._hashList[h].t = Date.now()
                ret = Object.assign({}, this._hashList[h].adv, adv)
            } 
        }
        return(ret) 
    } 
 

    // clear cache
    clear() 
    { 
        for (var hash in this._hashList) delete this._hashList[hash];
        this._hashListLength = 0;
    } 

    // dump cache contents
    readQueue(mode) 
    { 
        let ret = []; 
        for (var hash in this._hashList) {
            ret.push(this._hashList[hash])
        }
        return ret; 
    } 

    // clean cache every checkperiod seconds if adv is stale (t > TTL)
    _gcCleaner() {
        let tc = Date.now();
        for (const hash in this._hashList) {
            if(tc - this._hashList[hash].t > 1000*this.TTL){
                delete this._hashList[hash]
                this._hashListLength--;
            }
        }
    }

    //deep copy of adv object
    deepCopy(inObject){
        let outObject, value, key
      
        if (typeof inObject !== "object" || inObject === null) {
          return inObject // Return the value if inObject is not an object
        }
      
        // Create an array or object to hold the values
        outObject = Array.isArray(inObject) ? [] : {}
      
        for (key in inObject) {
          value = inObject[key]
      
          // Recursively (deep) copy for nested objects, including arrays
          outObject[key] = this.deepCopy(value)
        }
      
        return outObject
    }

} 

module.exports = {
    advCacheDecoder : advCacheDecoder,
}