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
        # -> Navigate to the WebApp or LarosaWebApp folder to find the login page or dashboard.
        frame = context.pages[-1]
        # Click on 'LarosaWebApp/' folder to find login or dashboard page
        elem = frame.locator('xpath=html/body/pre/a[10]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Go back to root directory to try another folder for login or dashboard.
        frame = context.pages[-1]
        # Click on '..' to go back to root directory
        elem = frame.locator('xpath=html/body/pre/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'LarosaWebApp/' folder to find login or dashboard page.
        frame = context.pages[-1]
        # Click on 'LarosaWebApp/' folder
        elem = frame.locator('xpath=html/body/pre/a[9]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Input username and password, then click the login button to access the dashboard.
        frame = context.pages[-1]
        # Input the username
        elem = frame.locator('xpath=html/body/div/div[2]/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('daffarafdhan')
        

        frame = context.pages[-1]
        # Input the password
        elem = frame.locator('xpath=html/body/div/div[2]/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('daffarafdhan212')
        

        frame = context.pages[-1]
        # Click the login button to submit credentials
        elem = frame.locator('xpath=html/body/div/div[2]/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=LAROSAPOT').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dashboard').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jumlah Pelanggan').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=7').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jumlah Vendor').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=20').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Barang Tersedia').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=3.097').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Produk Terjual').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=13').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Penjualan').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Rp610.000').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Pendapatan Diterima Dimuka').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Rp188.620.904').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sales Trend').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Kategori Produk').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    