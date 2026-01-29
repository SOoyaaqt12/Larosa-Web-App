/**
 * Data Service - Standardized data loading with caching
 * Provides a unified interface for loading data from Google Sheets with IndexedDB caching
 */

/**
 * Create a data service for a specific sheet
 * @param {Object} config - Configuration object
 * @param {string} config.sheetName - Name of the Google Sheet
 * @param {string} config.cacheKey - Key for IndexedDB cache
 * @param {number} [config.colSpan=8] - Column span for empty/error messages
 * @param {string} [config.emptyMessage="Tidak ada data"] - Message when no data
 * @param {string} [config.errorMessage="Gagal memuat data"] - Message on error
 */
function createDataService(config) {
  const {
    sheetName,
    cacheKey,
    colSpan = 8,
    emptyMessage = "Tidak ada data",
    errorMessage = "Gagal memuat data",
  } = config;

  const indicatorId = `${cacheKey}_refreshIndicator`;

  /**
   * Load data with cache-first strategy
   * @param {Object} options - Load options
   * @param {Function} options.onRender - Callback to render data
   * @param {HTMLElement} [options.tbody] - Table body element for messages
   * @param {Function} [options.onDataReady] - Callback when data is fully loaded
   * @returns {Promise<Array>} Loaded data
   */
  async function loadData(options) {
    const { onRender, tbody, onDataReady } = options;

    // Step 1: Immediately show cached data if available (Stale-While-Revalidate)
    const cached = await window.IDBCache?.get(cacheKey);
    const hasCache = cached && cached.data && cached.data.length > 0;

    if (hasCache) {
      console.log(`Showing cached ${cacheKey} data instantly`);
      onRender(cached.data);
    } else if (tbody) {
      // If no cache, show "Loading..." in the table so it doesn't look dead
      showTableMessage(tbody, "Sedang mengambil data dari server...", colSpan);
    }

    // Show refresh indicator (if we didn't show cache, or even if we did, to show we are updating)
    // Optional: You might want to be subtle if cache was shown, but user asked for "updates", so showing activity is good.
    showRefreshIndicator(indicatorId);

    // Step 2: Fetch fresh data in background (Always)
    try {
      const result = await fetchSheetData(sheetName);

      if (result.data && result.data.length > 0) {
        // Save to IndexedDB
        await window.IDBCache?.set(cacheKey, result.data);
        // Render fresh data
        onRender(result.data);
        console.log(`${cacheKey} data refreshed from server`);
        if (onDataReady) onDataReady(result.data);
        return result.data;
      } else if (!cached || !cached.data || cached.data.length === 0) {
        // Only show empty message if we have NO cache and NO new data
        if (tbody) {
          showTableMessage(tbody, emptyMessage, colSpan);
        }
      }
    } catch (error) {
      console.error(`Error loading ${cacheKey}:`, error);
      // Only show error in table if we have nothing to show at all
      if (!cached || !cached.data || cached.data.length === 0) {
        if (tbody) {
          showTableMessage(
            tbody,
            `${errorMessage}: ${error.message}`,
            colSpan,
            true,
          );
        }
      }
    } finally {
      hideRefreshIndicator(indicatorId);
    }

    // Return cached data if fetch failed, or empty array
    return cached && cached.data ? cached.data : [];
  }

  /**
   * Load grouped data (for invoice-like records)
   * @param {Object} options - Load options
   * @param {Function} options.onRender - Callback to render grouped data
   * @param {Function} options.groupFn - Function to group raw data
   * @param {HTMLElement} [options.tbody] - Table body element for messages
   * @returns {Promise<Object>} Grouped data { map, order }
   */
  async function loadGroupedData(options) {
    const { onRender, groupFn, tbody } = options;

    // Step 1: Show cached data immediately
    const cached = await window.IDBCache?.get(cacheKey);
    const hasCache =
      cached &&
      cached.data &&
      cached.data.map &&
      Object.keys(cached.data.map).length > 0;

    if (hasCache) {
      console.log(`Showing cached ${cacheKey} grouped data`);
      onRender(cached.data);
    } else if (tbody) {
      showTableMessage(tbody, "Sedang mengambil data dari server...", colSpan);
    }

    // Show refresh indicator
    showRefreshIndicator(indicatorId);

    // Step 2: Fetch fresh data
    try {
      const result = await fetchSheetData(sheetName);

      if (!result.data || result.data.length === 0) {
        if (!cached || !cached.data || !cached.data.map) {
          if (tbody) {
            showTableMessage(tbody, emptyMessage, colSpan);
          }
        }
        return { map: {}, order: [] };
      }

      // Group data
      const groupedData = groupFn(result.data);
      await window.IDBCache?.set(cacheKey, groupedData);
      onRender(groupedData);
      console.log(`${cacheKey} data refreshed from server`);
      return groupedData;
    } catch (error) {
      console.error(`Error loading ${cacheKey}:`, error);
      if (!cached || !cached.data) {
        if (tbody) {
          showTableMessage(
            tbody,
            `${errorMessage}: ${error.message}`,
            colSpan,
            true,
          );
        }
      }
      return cached && cached.data ? cached.data : { map: {}, order: [] };
    } finally {
      hideRefreshIndicator(indicatorId);
    }
  }

  /**
   * Clear cached data
   */
  async function clearCache() {
    await window.IDBCache?.clear(cacheKey);
  }

  /**
   * Update cache with new data
   * @param {Array|Object} data - Data to cache
   */
  async function updateCache(data) {
    await window.IDBCache?.set(cacheKey, data);
  }

  /**
   * Get cached data directly
   * @returns {Promise<Object|null>} Cached data or null
   */
  async function getCached() {
    return await window.IDBCache?.get(cacheKey);
  }

  return {
    loadData,
    loadGroupedData,
    clearCache,
    updateCache,
    getCached,
    sheetName,
    cacheKey,
  };
}

// Pre-configured data services for each page
const DataServices = {
  vendor: createDataService({
    sheetName: "VENDOR",
    cacheKey: "vendor_data_cache",
    colSpan: 9,
    emptyMessage: "Tidak ada data vendor",
  }),

  customer: createDataService({
    sheetName: "KOSTUMER",
    cacheKey: "kustomer_data_cache",
    colSpan: 8,
    emptyMessage: "Tidak ada data pelanggan",
  }),

  product: createDataService({
    sheetName: "PERSEDIAAN BARANG",
    cacheKey: "produk_data_cache",
    colSpan: 15,
    emptyMessage: "Tidak ada data produk",
  }),

  invoice: createDataService({
    sheetName: "INVOICE",
    cacheKey: "riwayat_data_cache",
    colSpan: 5,
    emptyMessage: "Belum ada riwayat transaksi",
  }),

  pelunasan: createDataService({
    sheetName: "DP/Pelunasan",
    cacheKey: "pelunasan_data_cache",
    colSpan: 6,
    emptyMessage: "Tidak ada data pelunasan",
  }),

  quotation: createDataService({
    sheetName: "QUOTATION",
    cacheKey: "quotation_data_cache",
    colSpan: 5,
    emptyMessage: "Belum ada data quotation",
  }),
};

// Export for global use
window.DataServices = DataServices;
window.createDataService = createDataService;
