'use strict'

module.exports={
    C : {
        //GAPI_SCAN_PASSIVE: 0,//
        //GAPI_SCAN_ACTIVE: 1,//
        GAPI_SHOW_CONNECTIONS_V3: 202,// *
        GAPI_CONNECT_V3: 204,// *
        //GAPI_DISCONNECTED: 5,//
        GAPI_SERVICES_ALL_V3: 209,// *
        GAPI_SERVICES_V3: 211,// *
        GAPI_CHARACTERISTICS_V3: 214,// *
        GAPI_SUBSCRIBE_INDICATE_V3: 216, // *
        GAPI_UNSUBSCRIBE_INDICATE_V3: 217, // *
        GAPI_SUBSCRIBE_NOTIFY_V3: 218, // *
        GAPI_UNSUBSCRIBE_NOTIFY_V3: 219, // *
        GAPI_READ_V3: 220, // *
        //GAPI_READ_UUID: 21,
        GAPI_READ_LONG_V3: 222,   /*AG ADDED*/ //*
        //GAPI_ENABLE_INDICATE: 26,
        //GAPI_ENABLE_NOTIFY: 27,
        GAPI_WRITE_V3: 228, // *
        GAPI_WRITE_LONG_V3: 229, // *
        GAPI_WRITE_NORESPONSE_V3: 230, // *
        //GAPI_DESCRIPTORS_ALL: 32,
        GAPI_DESCRIPTORS_V3: 233,// *
        GAPI_READ_DESCRIPTOR_V3: 234,  /*AG ADDED*/ // *
        GAPI_WRITE_DESCRIPTOR_V3: 235, // *
        GAPI_WRITE_DESCRIPTOR_LONG_V3: 236,  /*AG ADDED*/ // *
        GAPI_READ_DESCRIPTOR_LONG_V3: 237,  /*AG ADDED*/ // *
        //GAPI_PAIR: 41,
        /* */
        //GAPI_CONFIGURE: 51,
        /* */
        GAPI_VERSION_V3: 256,//  *
        //GAPI_ADVERTISE: 59,//

        /* NEW */
        //GAPI_GET_CLID: 101,
        GAPI_PING_V3: 302,// *
        GAPI_PING_DELAY_V3: 303,// *

        GAPI_DISCONNECT_ALL_V3: 305,   // *
        GAPI_DISCONNECT_NODE_V3: 306, // *

        GAPI_SCAN_START_V3: 310,// *
        GAPI_SCAN_CANCEL_V3: 311,// *
        GAPI_SCAN_STOP_V3: 312,// *
        GAPI_SCAN_PAUSE_V3: 313,// *
        GAPI_SCAN_RESUME_V3: 314,// *
        GAPI_SCAN_STATUS_V3: 315,// *

        GAPI_SCAN_CACHE_ENABLE_V3: 320,// *
        GAPI_SCAN_CACHE_READ_V3: 321,// *
        GAPI_SCAN_CACHE_GET_LENGTH_V3: 322,// *
        GAPI_SCAN_CACHE_CLEAR_V3: 323,// *
        GAPI_SCAN_CACHE_GET_PARAMETERS_V3: 324,// *
        GAPI_SCAN_CACHE_SET_PARAMETERS_V3: 325,// *
        GAPI_SCAN_GET_INITIAL_STATE_V3: 328,// *
        GAPI_SCAN_SET_INITIAL_STATE_V3: 329,// *



        GAPI_ADVERTISEMENT_START_V3: 330,// *
        GAPI_ADVERTISEMENT_STOP_V3: 331,// *
        GAPI_ADVERTISEMENT_CONFIG_TIMIG_V3: 332, //*
        GAPI_ADVERTISEMENT_CONFIG_DATA_V3: 333, //*
        GAPI_ADVERTISEMENT_STATUS_V3: 334,// *
        GAPI_ADVERTISEMENT_GET_INIT_STATE_V3: 335,
        GAPI_ADVERTISEMENT_SET_INIT_STATE_V3: 336,

        GAPI_SHOW_CONNECTION_DETAILS_V3: 350,// *

        GAPI_CREATE_PAIR_V3: 360, // *
        GAPI_DELETE_PAIR_V3: 361, // *
        GAPI_LIST_PAIR_V3: 362, // *
        GAPI_PAIR_KEY_v3: 363,

        GAPI_EXEC_QUEUE_STATUS_V3: 370,
        //GAPI_EXEC_QUEUE_LIST_V3: 371,
        //GAPI_EXEC_QUEUE_FLUSH_V3: 372,
        GAPI_EXEC_QUEUE_STOP_V3: 373,
        GAPI_EXEC_QUEUE_CONTINUE_V3: 374,
        GAPI_EXEC_QUEUE_RUN_ONCE_V3: 375,
        //GAPI_EXEC_QUEUE_FLUSH_CURRENT: 177,

        GAPI_SUBSCRIBE_INDICATE_DIRECT_v3: 380,
        GAPI_UNSUBSCRIBE_INDICATE_DIRECT_v3: 381,
        GAPI_SUBSCRIBE_NOTIFY_DIRECT_v3: 382,
        GAPI_UNSUBSCRIBE_NOTIFY_DIRECT_v3: 383,
    },



    DEV_TYPE_B24C: 10,
    DEV_TYPE_E24:20,
    DEV_TYPE_ES:30,
    DEV_TYPE_CLIENT:40, 

//switchyard for command subsystem
    EXEC_ERROR: 0,
    EXEC_GAPI: 1,
    EXEC_SCAN_MANAGER:2,
    EXEC_ADV_MANAGER:3,
    EXEC_SYSTEM:4,

    /* */
    IFACE_ID_SYSTEM: 0,
    IFACE_ID_GAPI: 1,
    IFACE_ID_CLIENT: 10,

    
    
    GAPI_SUCCESS:                          200,
    GAPI_BAD_REQUEST:                      400,
    GAPI_AUTHENTICATION_ERROR:             401,
    GAPI_FORBIDDEN_REQUEST:                403,
    GAPI_REQUEST_NOT_FOUND:                404,
    GAPI_METHOD_NOT_ALLOWED:               405,
    GAPI_PARAMETERS_NOT_ACCEPTABLE:        406,
    GAPI_CONFLICT:                         409,
    GAPI_REQUEST_PRECONDITION_FAILED:      412,
    GAPI_PARAMETER_MISSING:                441,
    GAPI_PARAMETER_VALUE_NOT_VALID:        442,
    GAPI_UNEXPECTED_INTERNAL_CONDITION:    443,
    GAPI_INTERNAL_ERROR:                   500,
    GAPI_NO_CONNECTION:                    504,
    GAPI_CONNECTION_EXISTS:                505,
    GAPI_OUT_OF_RESOURCES:                 507,

    /* NEW */
    GAPI_REQUEST_TIMEOUT:                  408,
    GAPI_REQUEST_CANCELLED:                450,
    GAPI_MQTT_ERROR:                       451,
    GAPI_MALFORMED_PAYLOAD:                 452,
    SC_GAPI_NO_CONNECTION_REMOTE:          4000,
    //SC_GAPI_PARAMETERS_NOT_ACCEPTABLE:     4001, 

    
    GAPI_EVENT_DISCONNECT:								1,	//special err													
    GAPI_EVENT_COMMAND_COMPLETE:                        2,
    GAPI_EVENT_COMMAND_STATUS:                          3,
    GAPI_EVENT_HARDWARE_ERROR:							4,	//special err
    GAPI_EVENT_READ_RSSI:                               5,
    GAPI_EVENT_READ_CHANNEL_MAP:                        6,
    GAPI_EVENT_CONNECTION_COMPLETE:                     7,
    GAPI_EVENT_ADVERTISING_REPORT:                      8,
    GAPI_EVENT_CONNECTION_UPDATE_COMPLETE:              9,
    GAPI_EVENT_CONNECTION_CANCELLATION:                 10,
    GAPI_EVENT_READ_REMOTE_FEATURES_COMPLETE:           11,
    GAPI_EVENT_LTK_REQUEST:                             12,
    GAPI_EVENT_REMOTE_CONNECTION_PARAMETER_REQUEST:     13,
    GAPI_EVENT_DATA_LENGTH_CHANGE:                      14,
    GAPI_EVENT_READ_LOCAL_P256_KEY_COMPLETE:            15,
    GAPI_EVENT_GENERATE_DHKEY_COMPELETE:                16,
    GAPI_EVENT_ENHANCED_CONNECTION_COMPLETE:            17,
    GAPI_EVENT_DIRECT_ADVERTISING_REPORT:               18,
    GAPI_EVENT_ENCRYPTION_CHANGE:                       19,
    GAPI_EVENT_ENCRYPTION_KEY_REFRESH:                  20,
    GAPI_EVENT_PAIRING_COMPLETE:                        32,
    GAPI_EVENT_GATT_ERROR:                              33, //err
    GAPI_EVENT_NON_SPECIFIC_ERROR:                      34, //err
    GAPI_EVENT_SECURITY_REQUEST:                        37,
    GAPI_EVENT_GAPI_REQUEST_ERROR:                      38, //err
    GAPI_EVENT_SCAN_ENABLE:                             39,
    GAPI_EVENT_TRANSMIT_POWER:                          40,
    GAPI_EVENT_AUTHENTICATION_KEY_REQUEST:              41,
    GAPI_EVENT_PAIRING_REQUEST:                         42,
    GAPI_EVENT_LE_RANDOM_NUMBER:                        44,

    /* NEW */
    GAPI_EVENT_SCAN_START:                         101,
    GAPI_EVENT_SCAN_STOP:                          102,
    GAPI_EVENT_SCAN_STATE_CHANGE:                  103,
    GAPI_EVENT_CONNECT_N:                          104,
    GAPI_EVENT_DISCONNECT_N:                       105,
//sub-code
    SC_GAPI_EVENT_SCAN_I_TO_I:                        201,
    SC_GAPI_EVENT_SCAN_I_TO_P:                        202,
    SC_GAPI_EVENT_SCAN_I_TO_A:                        203,
    SC_GAPI_EVENT_SCAN_I_TO_H:                        204,
    SC_GAPI_EVENT_SCAN_P_TO_I:                        205,
    SC_GAPI_EVENT_SCAN_P_TO_P:                        206,
    SC_GAPI_EVENT_SCAN_P_TO_A:                        207,
    SC_GAPI_EVENT_SCAN_P_TO_H:                        208,
    SC_GAPI_EVENT_SCAN_A_TO_I:                        209,
    SC_GAPI_EVENT_SCAN_A_TO_P:                        210,
    SC_GAPI_EVENT_SCAN_A_TO_A:                        211,
    SC_GAPI_EVENT_SCAN_A_TO_H:                        212,
    SC_GAPI_EVENT_SCAN_H_TO_I:                        213,
    SC_GAPI_EVENT_SCAN_H_TO_P:                        214,
    SC_GAPI_EVENT_SCAN_H_TO_A:                        215,
    SC_GAPI_EVENT_SCAN_H_TO_H:                        216,
    SC_GAPI_EVENT_SCAN_UNK:                           217,
    SC_GAPI_EVENT_SCAN_X_TO_I:                        218,

    /* from API webpage*/
SUBCODE_ERROR_SUCCESS:                    0,
SUBCODE_ERROR_RSVD1:                     -1,
SUBCODE_ERROR_RSVD2:                     -2,
SUBCODE_ERROR_INVALID_HANDLE:            -3,
SUBCODE_ERROR_INVALID_CONNECTION_HANDLE: -4,
SUBCODE_ERROR_UNUSED_CONNECTION_HANDLE:  -5,
SUBCODE_ERROR_INVALID_PARAMETER:         -6,
SUBCODE_ERROR_CONNECTION_IN_PROGRESS:    -7,
SUBCODE_ERROR_CONNECTION_TIMEOUT:        -8,
SUBCODE_ERROR_CONNECTION_LIMIT:          -9,
SUBCODE_ERROR_CONNECTION_EXISTS:         10,
SUBCODE_ERROR_DISCONNECT_IN_PROGRESS:   -11,
SUBCODE_ERROR_NO_DISCOVERED_CONTAINER:  -12,
SUBCODE_ERROR_NO_GATT_ENTITY:           -13,
SUBCODE_ERROR_INVALID_ADDRESS_TYPE:     -14,
SUBCODE_ERROR_NO_ADDRESS:               -15,
SUBCODE_ERROR_INVALID_CALL_STATE:       -16,
SUBCODE_ERROR_INVALID_OPERATION:        -17,
SUBCODE_ERROR_TOO_SMALL:                -18,
SUBCODE_ERROR_TOO_LARGE:                -19,
SUBCODE_ERROR_FLOW_CONTROL:             -20,
SUBCODE_ERROR_COMPUTATION_FAILED:       -21,
SUBCODE_ERROR_AUTHENTICATION:           -22,
SUBCODE_ERROR_ENCRYPTION:               -23,
SUBCODE_ERROR_ATT_TIMEOUT:              -24,
SUBCODE_ERROR_BOND_LOST:                -25,
SUBCODE_ERROR_IO:                       -26,
SUBCODE_ERROR_RESOURCES_EXCEEDED:       -97,
SUBCODE_ERROR_UNKNOWN:                  -98,

    
    
    /* GAPI Advertising subcommands */
    GAPI_ADVERTISE_SET_PARAMETERS: 1,
    GAPI_ADVERTISE_SET_DATA: 2,
    GAPI_ADVERTISE_ENABLE: 4,
    
    /* GAPI data types */
    GAP_FLAGS: 0x01,
    GAP_INCOMPLETE_SERVICE16: 0x02,
    GAP_COMPLETE_SERVICE16: 0x03,
    GAP_INCOMPLETE_SERVICE32: 0x04,
    GAP_COMPLETE_SERVICE32: 0x05,
    GAP_INCOMPLETE_SERVICE128: 0x06,
    GAP_COMPLETE_SERVICE128: 0x07,
    GAP_SHORT_LOCAL_NAME: 0x08,
    GAP_COMPLETE_LOCAL_NAME: 0x09,
    GAP_TX_POWER_LEVEL: 0x09,
    /* */
    GAP_SERVICE_DATA16: 0x16,
    /* */
    GAP_SERVICE_DATA32: 0x20,
    GAP_SERVICE_DATA128: 0x21,
    /* */
    GAP_PB_ADV: 0x29,
    GAP_MESH_MESSAGE: 0x2A,
    GAP_MESH_BEACON: 0x2B,
    /* */
    GAP_MANUFACTURER_SPECIFIC: 0xFF,
    
    SERVICE_PROVISIONING: '1827',
    SERVICE_PROXY: '1828',
    
    
    /* Characteristic Properties */
    CHAR_PROPERTY_READ: 0x02,
    CHAR_PROPERTY_WRITE_NORESPONSE: 0x04,
    CHAR_PROPERTY_WRITE: 0x08,
    CHAR_PROPERTY_NOTIFY: 0x10,
    CHAR_PROPERTY_INDICATE: 0x20,
    CHAR_PROPERTY_EXTENDED: 0x80,
}