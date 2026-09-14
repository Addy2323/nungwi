from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

root = Path(__file__).resolve().parent
options = Options()
options.add_argument('--headless=new')
options.add_argument('--window-size=1672,941')
options.add_argument('--force-device-scale-factor=1')
options.add_argument('--disable-gpu')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 40)
def click(text):
    wait.until(EC.element_to_be_clickable((By.XPATH, f"//button[normalize-space(.)='{text}' or .//b[normalize-space(.)='{text}']]"))).click()
try:
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': "window.dashboardErrors=[]; window.addEventListener('error', e => window.dashboardErrors.push(e.error?.stack || e.message));"})
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': 1672, 'height': 941, 'deviceScaleFactor': 1, 'mobile': False})
    driver.get('http://localhost:3000/')
    wait.until(EC.visibility_of_element_located((By.XPATH, "//h1[contains(., 'Good morning')]")))
    driver.execute_async_script('document.fonts.ready.then(arguments[0])')
    driver.save_screenshot(str(root / 'dashboard-desktop.png'))
    print('Desktop overflow:', driver.execute_script('return document.documentElement.scrollWidth > innerWidth'))
    search = driver.find_element(By.CSS_SELECTOR, 'input[aria-label="Search orders, products, customers"]')
    search.send_keys('Amina')
    assert len(driver.find_elements(By.XPATH, '//tbody/tr')) == 1
    search.clear()
    search.send_keys(' ')
    search.clear()
    driver.find_element(By.CSS_SELECTOR, 'input[aria-label="Search orders, products, customers"]').send_keys('')
    click('Add product')
    driver.find_element(By.NAME, 'name').send_keys('Test coconut')
    driver.find_element(By.NAME, 'stock').clear()
    driver.find_element(By.NAME, 'stock').send_keys('25')
    click('Save product')
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, 'main'), 'Test coconut'))
    click('Overview')
    click('Manage stock')
    Select(driver.find_element(By.NAME, 'product')).select_by_visible_text('Safari Lager (330ml)')
    driver.find_element(By.NAME, 'stock').send_keys('40')
    click('Save stock')
    assert '40' in driver.find_element(By.TAG_NAME, 'main').text
    click('Overview')
    Select(driver.find_element(By.CSS_SELECTOR, 'select[aria-label="Revenue date range"]')).select_by_visible_text('Last 30 days')
    assert 'Jun 14' in driver.find_element(By.TAG_NAME, 'main').text
    click('Overview')
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    driver.refresh()
    wait.until(EC.visibility_of_element_located((By.TAG_NAME, 'h1')))
    driver.execute_async_script('document.fonts.ready.then(arguments[0])')
    driver.save_screenshot(str(root / 'dashboard-mobile.png'))
    assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth'), 'Mobile overflow'
    driver.find_element(By.CSS_SELECTOR, 'button[aria-label="Toggle navigation"]').click()
    click('Orders')
    assert driver.find_element(By.TAG_NAME, 'h1').text == 'Orders'
    print('PASS: search, add product, stock update, date range, mobile layout and navigation')
    errors = [entry['message'] for entry in driver.get_log('browser') if entry['level'] == 'SEVERE']
    (root / 'dashboard-browser-errors.txt').write_text('\n'.join(errors + driver.execute_script('return window.dashboardErrors || []')), encoding='utf-8')
    print('Browser errors:', len(errors))
finally:
    driver.quit()
