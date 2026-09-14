from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

root = Path(__file__).resolve().parent
options = Options()
options.add_argument('--headless=new')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 40)
try:
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': 1512, 'height': 982, 'deviceScaleFactor': 1, 'mobile': False})
    driver.get('http://localhost:3000/login')
    wait.until(EC.visibility_of_element_located((By.ID, 'email')))
    driver.execute_async_script('document.fonts.ready.then(arguments[0])')
    driver.save_screenshot(str(root / 'auth-desktop.png'))
    assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth')
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    assert not driver.execute_script('return document.querySelector("form").checkValidity()')
    driver.find_element(By.ID, 'email').send_keys('preview@example.com')
    driver.find_element(By.ID, 'password').send_keys('Preview-password-123')
    driver.find_element(By.CSS_SELECTOR, 'button[aria-label="Show password"]').click()
    assert driver.find_element(By.ID, 'password').get_attribute('type') == 'text'
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    assert 'not connected yet' in driver.find_element(By.CSS_SELECTOR, '[role="status"]').text
    assert driver.find_element(By.ID, 'password').get_attribute('value') == ''
    assert 'Preview-password' not in driver.execute_script('return JSON.stringify(localStorage)+JSON.stringify(sessionStorage)')
    driver.get('http://localhost:3000/signup')
    wait.until(EC.visibility_of_element_located((By.ID, 'full-name')))
    driver.find_element(By.ID, 'full-name').send_keys('Preview Customer')
    driver.find_element(By.ID, 'email').send_keys('preview@example.com')
    driver.find_element(By.ID, 'password').send_keys('Password-one')
    driver.find_element(By.ID, 'confirm-password').send_keys('Password-two')
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    assert driver.find_element(By.ID, 'confirm-password').get_attribute('aria-invalid') == 'true'
    driver.find_element(By.ID, 'confirm-password').clear()
    driver.find_element(By.ID, 'confirm-password').send_keys('Password-one')
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    assert 'No account has been created' in driver.find_element(By.CSS_SELECTOR, '[role="status"]').text
    driver.get('http://localhost:3000/forgot-password')
    wait.until(EC.visibility_of_element_located((By.ID, 'email'))).send_keys('preview@example.com')
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    assert 'No email has been sent' in driver.find_element(By.CSS_SELECTOR, '[role="status"]').text
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    driver.get('http://localhost:3000/login')
    wait.until(EC.visibility_of_element_located((By.ID, 'email')))
    driver.execute_async_script('document.fonts.ready.then(arguments[0])')
    driver.save_screenshot(str(root / 'auth-mobile.png'))
    assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth')
    preview = driver.find_element(By.LINK_TEXT, 'Explore the customer preview')
    driver.execute_script('arguments[0].scrollIntoView({behavior:"instant",block:"center"})', preview)
    preview.click()
    wait.until(EC.url_contains('/customer'))
    errors = [e['message'] for e in driver.get_log('browser') if e['level'] == 'SEVERE']
    (root / 'auth-browser-errors.txt').write_text('\n'.join(errors), encoding='utf-8')
    print('PASS: desktop/mobile layout, required fields, password toggle, confirmation validation, truthful preview submissions, customer link, no stored credentials')
    print('Browser errors:', len(errors))
finally:
    driver.quit()
