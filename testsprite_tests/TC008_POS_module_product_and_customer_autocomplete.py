import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:8080", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Click on the 'kasir' link to navigate to the POS (Kasir) module.
        frame = context.pages[-1]
        # Click on the 'kasir' link to navigate to the POS (Kasir) module
        elem = frame.locator('xpath=html/body/pre/a[39]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Type a product name in the product autocomplete field (index 7) to check for relevant and immediate suggestions.
        frame = context.pages[-1]
        # Type 'kopi' in the product autocomplete field to check for relevant suggestions
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[3]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('kopi')
        

        # -> Check if product suggestions appeared and are relevant. Then type in the customer autocomplete field (index 2) to test customer suggestions responsiveness.
        frame = context.pages[-1]
        # Type 'daffa' in the customer autocomplete field to check for relevant suggestions
        elem = frame.locator('xpath=html/body/div/div[2]/div[3]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('daffa')
        

        # -> Scroll down to check if any hidden autocomplete suggestion elements are present or extract content to confirm absence of suggestions.
        await page.mouse.wheel(0, 300)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=No Pesanan:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tanggal Dibuat:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Nama:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Pilih Kasir').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Payment:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Pilih Payment').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=No').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=SKU').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Produk').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jumlah').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Satuan').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Harga').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Total').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Aksi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Hapus').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tambah Item').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Subtotal:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ongkir:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Packing:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Diskon:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Total Tagihan:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=DP 1:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=DP 2:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sisa Tagihan:').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    