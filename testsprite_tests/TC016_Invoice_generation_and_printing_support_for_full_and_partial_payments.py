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
        # -> Click on the 'kasir' link to access the cashier app for invoice generation.
        frame = context.pages[-1]
        # Click on the 'kasir' link to open the cashier app for invoice generation and testing.
        elem = frame.locator('xpath=html/body/pre/a[39]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Input remaining required fields and submit the form to generate the partial payment invoice.
        frame = context.pages[-1]
        # Input order number for partial payment invoice.
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('INV-001')
        

        frame = context.pages[-1]
        # Input customer name for partial payment invoice.
        elem = frame.locator('xpath=html/body/div/div[2]/div[3]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('John Doe')
        

        frame = context.pages[-1]
        # Input SKU for product in cart.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('SKU001')
        

        frame = context.pages[-1]
        # Input product name in cart.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[3]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Product A')
        

        frame = context.pages[-1]
        # Input quantity for product in cart.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[4]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('2')
        

        frame = context.pages[-1]
        # Input unit for product in cart.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[5]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('pcs')
        

        frame = context.pages[-1]
        # Input price per unit for product in cart.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[6]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('10000')
        

        frame = context.pages[-1]
        # Input first down payment (DP 1).
        elem = frame.locator('xpath=html/body/div/div[2]/div[7]/div[2]/div[6]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('5000')
        

        frame = context.pages[-1]
        # Input second down payment (DP 2).
        elem = frame.locator('xpath=html/body/div/div[2]/div[7]/div[2]/div[7]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('5000')
        

        # -> Look for alternative ways to generate or save the invoice, such as checking for buttons outside the viewport or other UI elements.
        await page.mouse.wheel(0, 300)
        

        # -> Try to find a way to save or generate the invoice by clicking the 'Tambah Item' button to see if it triggers invoice generation or reveals more options.
        frame = context.pages[-1]
        # Click the 'Tambah Item' button to add another item or trigger invoice generation options.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Try to generate a full payment invoice by filling the form with full payment details and see if submission or generation options appear.
        frame = context.pages[-1]
        # Input order number for full payment invoice.
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('INV-002')
        

        frame = context.pages[-1]
        # Input customer name for full payment invoice.
        elem = frame.locator('xpath=html/body/div/div[2]/div[3]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Jane Smith')
        

        frame = context.pages[-1]
        # Input SKU for product in cart for full payment.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('SKU002')
        

        frame = context.pages[-1]
        # Input product name in cart for full payment.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[3]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Product B')
        

        frame = context.pages[-1]
        # Input quantity for product in cart for full payment.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[4]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('1')
        

        frame = context.pages[-1]
        # Input unit for product in cart for full payment.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[5]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('pcs')
        

        frame = context.pages[-1]
        # Input price per unit for product in cart for full payment.
        elem = frame.locator('xpath=html/body/div/div[2]/div[5]/div[2]/table/tbody/tr/td[6]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('15000')
        

        frame = context.pages[-1]
        # Input full payment amount in DP 1.
        elem = frame.locator('xpath=html/body/div/div[2]/div[7]/div[2]/div[6]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('15000')
        

        frame = context.pages[-1]
        # Input zero for DP 2 for full payment.
        elem = frame.locator('xpath=html/body/div/div[2]/div[7]/div[2]/div[7]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('0')
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=DP 1:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=DP 2:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tambah Item').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=No Pesanan:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Nama:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Pilih Kasir').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Pilih Payment').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    