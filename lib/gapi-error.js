/*
 * Netrunr GAPI MQTT asynchronous API
 *
 * Copyright(C) 2020 Axiomware Systems Inc..
 */

'use strict'

module.exports = class GapiError extends Error {
  constructor (message, errData, result, subcode) {
    super(message)
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
    this.name = this.constructor.name
    // Custom debugging information
    this.result = result || 400// result code from MQTT event/response
    this.subcode = subcode || 0// subcode from MQTT event/respone
    this.errData = errData || ''// Data from the MQTT event/response
    this.date = new Date()
  }
}
