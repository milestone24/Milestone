import { searchCachedSecurities, getCachedSecurities, createOrFindCachedSecurity, updateCachedSecurity, deleteCachedSecurity, getCachedSecurity } from "./cache"
import { factory as assetValueSyncFactory } from "./sync/asset-value"
//import { factory as cacheFactory } from "./sync/cache"
import { factory as gatewayFactory } from "./gateway"

const gateway = gatewayFactory()
const assetValueSync = assetValueSyncFactory()
//const cacheSync = cacheFactory()

export const factory = () => {
  return {
    // Existing methods
    ...gateway,
    // Sync module methods
    ...assetValueSync,
    //...cacheSync,
    searchCachedSecurities,
    getCachedSecurities,
    createOrFindCachedSecurity,
    updateCachedSecurity,
    deleteCachedSecurity,
    getCachedSecurity,
    
  }
}
