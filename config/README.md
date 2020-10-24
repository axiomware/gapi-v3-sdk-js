# Cache file for storing GATT tables

This application will store the results of service discovery (mapping handles to services, characteristics and descriptors) when connected to a device for the first time. For complicated devices, this process may take several seconds. On the next connection to the same device, the application program will use the data in `config_gatt.json` file to speed up discovery. If the cache information is stale or not in sync with the actual firmware of the peripheral device, you can delete this file and regenerate the GATT table information.
