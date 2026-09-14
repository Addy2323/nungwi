from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

root = Path(__file__).resolve().parent
options = Options()
options.add_argument('--headless=new')
options.add_argument('--force-device-scale-factor=1')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 40)
def click(text):
    wait.until(EC.element_to_be_clickable((By.XPATH, f"//button[normalize-space(.)='{text}']"))).click()
def named(label):
    return wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, f'[aria-label="{label}"]')))
try:
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': "window.customerErrors=[];window.addEventListener('error',e=>window.customerErrors.push(e.error?.stack||e.message));"})
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': 1672, 'height': 1060, 'deviceScaleFactor': 1, 'mobile': False})
    driver.get('http://localhost:3000/customer')
    wait.until(EC.visibility_of_element_located((By.TAG_NAME, 'h1')))
    driver.execute_async_script('document.fonts.ready.then(arguments[0])')
    driver.save_screenshot(str(root / 'customer-desktop.png'))
    assert not driver.execute_script('return document.documentElement.scrollWidth>innerWidth')
    click('Track my order')
    assert driver.find_element(By.TAG_NAME, 'dialog').is_displayed()
    driver.find_element(By.TAG_NAME, 'dialog').send_keys('\ue00c')
    wait.until(EC.invisibility_of_element_located((By.TAG_NAME, 'dialog')))
    click('My Orders')
    named('Search your orders and favourites').send_keys('10412')
    assert len(driver.find_elements(By.CSS_SELECTOR, 'tbody tr')) == 1
    click('Order again')
    assert 'Zanzibar Sunrise' in driver.find_element(By.TAG_NAME, 'dialog').text
    driver.find_element(By.LINK_TEXT, 'Continue in shop').click()
    wait.until(EC.visibility_of_element_located((By.XPATH, "//button[contains(.,'Cart (2)')]")))
    driver.find_element(By.LINK_TEXT, 'My Account').click()
    wait.until(EC.element_to_be_clickable((By.LINK_TEXT, 'Explore the customer preview'))).click()
    wait.until(EC.visibility_of_element_located((By.TAG_NAME, 'h1')))
    named('Remove Mango Coast from favourites').click()
    driver.refresh()
    named('Save Mango Coast to favourites')
    click('Delivery Locations')
    click('Add location')
    driver.find_element(By.NAME, 'label').send_keys('Test villa')
    driver.find_element(By.NAME, 'detail').send_keys('Kendwa, villa 4')
    click('Save location')
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, 'main'), 'Test villa'))
    driver.refresh()
    click('Delivery Locations')
    assert 'Test villa' in driver.find_element(By.TAG_NAME, 'main').text
    named('Delete Test villa').click()
    assert 'Test villa' not in driver.find_element(By.TAG_NAME, 'main').text
    click('Account Settings')
    profile_name = driver.find_element(By.CSS_SELECTOR, 'main form input')
    profile_name.clear()
    profile_name.send_keys('Test Customer')
    click('Save changes')
    driver.refresh()
    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, 'h1'), 'Jambo, Test!'))
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    driver.refresh()
    wait.until(EC.visibility_of_element_located((By.TAG_NAME, 'h1')))
    driver.execute_async_script('document.fonts.ready.then(arguments[0])')
    driver.save_screenshot(str(root / 'customer-mobile.png'))
    assert not driver.execute_script('return document.documentElement.scrollWidth>innerWidth')
    named('Toggle navigation').click()
    click('My Orders')
    assert driver.find_element(By.TAG_NAME, 'h1').text == 'My Orders'
    errors = [e['message'] for e in driver.get_log('browser') if e['level'] == 'SEVERE']
    (root / 'customer-browser-errors.txt').write_text('\n'.join(errors + driver.execute_script('return window.customerErrors||[]')), encoding='utf-8')
    print('PASS: tracking dialog, order search, reorder/shared basket, favourites, locations, profile persistence, mobile navigation and overflow')
    print('Browser errors:',len(errors))
finally:
    driver.quit()
