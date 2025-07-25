The cache monitor is misguided. As each window is a distinct javascript operating environment, the page can only monitor caches on it's own window, not the windows I'm interested in. So I'd like to transform the cache monitoring to be an extension of the introspection widget we already have.



i don't think DataAvailabilityInfo and PartialCoalStripesData are still needed. please make a list of who still uses them and whether they are still needed. if needed, can it be simplified?

OpenElectricityUnit, OpenElectricityFacility and OpenElectricityDataRow all look like they are specific to the OE API. are they used outside the server module?

CoalUnit should be renamed GeneratingUnit

CoalStripesData should be renamed GeneratingUnitCapFacHistory

UnitHistory, CoalUnit and GeneratingUnitCapFacHistory all look like they are to build the "over the wire" object that the server returns. What's an appropriate naming convention to indicate that these are interfaces?

GeneratingUnitCapFacHistory should only be used for "over the wire"… and therefore shouldn't include monthlyAverages.

UnitHistory must always have a data array. ie, do not make the data optional.


rename CoalDataService to CapFacDataService, and coal-data-service accordingly.


Add a function getTodayAEST to date-utils that returns a CalendarDate object with the today of today in AEST.


src/app/client has temporal-utils.ts — the client should not use this file, but should instead use shared/date-utils. change all usage of temporal-utils.ts to shared/date-utils, creating missing functions only if necessary.


rename QueuedOpenElectricityClient to OEClientQueued, and openelectricity-queue.ts to queued-oeclient


rename SmartCache to CapFacDataCache
remove getDataForDateRange and highlight any tests this will break.

makes CacheStats generic.

i see "const currentYearValue = new Date().getFullYear();" in CapFacDataCache. get rid of this usage of Date.

