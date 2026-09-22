"""Read-only ERP desktop/mobile smoke check; called by scripts/check-erp.ts."""
import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

root = Path(__file__).resolve().parent
options = Options()
options.add_argument('--headless=new')
options.add_argument('--window-size=1500,1000')
options.add_argument('--disable-gpu')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 60)
base = 'http://localhost:3001'

def click(label):
    element = wait.until(EC.element_to_be_clickable((By.XPATH, f"//button[normalize-space(.)='{label}']")))
    driver.execute_script("arguments[0].scrollIntoView({block:'center',behavior:'instant'})", element)
    wait.until(lambda _: driver.execute_script("const r=arguments[0].getBoundingClientRect(); const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return el && arguments[0].contains(el)", element))
    element.click()

try:
    driver.get(base + '/login')
    driver.add_cookie({'name':'nungwi_session', 'value':os.environ['NUNGWI_BROWSER_TOKEN'], 'path':'/'})
    driver.get(base + '/dashboard?tab=ERP')
    wait.until(EC.visibility_of_element_located((By.XPATH, "//h2[normalize-space(.)='Purchase orders']")))
    assert driver.find_elements(By.XPATH, "//nav//button[normalize-space(.)='ERP']")
    click('New purchase order')
    assert driver.find_elements(By.NAME, 'supplier')
    assert driver.find_elements(By.XPATH, "//button[normalize-space(.)='Save draft']")
    click('Cancel')
    click('Suppliers')
    click('Add supplier')
    assert driver.find_elements(By.NAME, 'payment_days')
    click('Cancel')
    click('Supplier bills')
    wait.until(EC.visibility_of_element_located((By.XPATH, "//h2[normalize-space(.)='Supplier bills and payments']")))
    click('Customer invoices')
    click('Issue invoice')
    assert driver.find_elements(By.NAME, 'order_id')
    click('Cancel')
    click('Set payment terms')
    assert driver.find_elements(By.NAME, 'user_id')
    click('Cancel')
    click('Finance')
    wait.until(EC.visibility_of_element_located((By.XPATH, "//h2[normalize-space(.)='Transaction reconciliation']")))
    export = driver.execute_async_script("fetch('/api/erp?export=finance').then(async r => arguments[0]({status:r.status,body:await r.text()}))")
    assert export['status'] == 200 and 'Signed amount TZS' in export['body']
    assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth'), 'Desktop overflow'
    driver.save_screenshot(str(root / 'erp-desktop.png'))
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':390,'height':844,'deviceScaleFactor':1,'mobile':False})
    click('Purchasing')
    click('New purchase order')
    assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth'), 'Mobile overflow'
    driver.save_screenshot(str(root / 'erp-mobile.png'))
    errors = [entry['message'] for entry in driver.get_log('browser') if entry['level'] == 'SEVERE']
    (root / 'erp-browser-errors.txt').write_text('\n'.join(errors), encoding='utf-8')
    assert not errors, '\n'.join(errors)
    print('PASS: ERP navigation, five modules, entry forms, authenticated CSV export, desktop and mobile layouts; no browser errors.')
finally:
    driver.quit()
