/**
 * IndexedDB Cache Helper
 * Provides large storage capacity for caching data (100MB+)
 */

const DB_NAME = "LarosapotCache";
const DB_VERSION = 1;
const STORE_NAME = "dataCache";

let dbInstance = null;

/**
 * Initialize IndexedDB
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

/**
 * Get cached data from IndexedDB
 * @param {String} key - Cache key
 * @returns {Promise<any>} Cached data or null
 */
async function getCachedData(key) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.data) {
          // Check if cache is still valid (5 minutes)
          const CACHE_DURATION = 5 * 60 * 1000;
          if (Date.now() - result.timestamp < CACHE_DURATION) {
            resolve({ data: result.data, valid: true });
          } else {
            resolve({ data: result.data, valid: false });
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error("Error getting cached data:", request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error("IndexedDB getCachedData error:", error);
    return null;
  }
}

/**
 * Save data to IndexedDB cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
async function setCachedData(key, data) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        key: key,
        data: data,
        timestamp: Date.now(),
      });

      request.onsuccess = () => {
        console.log(`Cache saved: ${key}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error("Error saving cache:", request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error("IndexedDB setCachedData error:", error);
    return false;
  }
}

/**
 * Clear specific cache key
 * @param {string} key - Cache key to clear
 */
async function clearCachedData(key) {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    console.error("IndexedDB clearCachedData error:", error);
    return false;
  }
}

/**
 * Clear all cache
 */
async function clearAllCache() {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log("All cache cleared");
        resolve(true);
      };
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    console.error("IndexedDB clearAllCache error:", error);
    return false;
  }
}

// Export for global use
window.IDBCache = {
  get: getCachedData,
  set: setCachedData,
  clear: clearCachedData,
  clearAll: clearAllCache,
};
