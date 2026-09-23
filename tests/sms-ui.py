"""Headless registration check against localhost:3100; all signup traffic is mocked."""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

options = Options()
options.add_argument('--headless=new')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
browser = webdriver.Chrome(options=options)
wait = WebDriverWait(browser, 30)
mock = """
const original = window.fetch.bind(window);
window.fetch = (url, options) => {
  if (String(url).includes('/api/platform') && options?.method === 'POST') {
    const request = JSON.parse(options.body);
    if (request.action === 'auth.signup') return Promise.resolve(new Response(JSON.stringify({data:{challenge:'11111111-1111-4111-8111-111111111111',message:'Verification queued for UI test.'}}),{status:200,headers:{'Content-Type':'application/json'}}));
    if (request.action === 'auth.signup-verify') return Promise.resolve(new Response(JSON.stringify({data:{message:'Phone verification UI passed.'}}),{status:200,headers:{'Content-Type':'application/json'}}));
    return Promise.reject(new Error('Unexpected mutation blocked by UI test'));
  }
  return original(url, options);
};
"""
try:
    browser.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': mock})
    for width in [1440,390]:
        browser.set_window_size(width,1000)
        browser.get('http://localhost:3100/signup')
        wait.until(EC.visibility_of_element_located((By.ID,'full-name'))).send_keys('UI Test')
        browser.find_element(By.ID,'phone').send_keys('0712345678')
        browser.find_element(By.ID,'email').send_keys('ui-test@example.test')
        browser.find_element(By.ID,'password').send_keys('UI-test-password-2026')
        browser.find_element(By.ID,'confirm-password').send_keys('UI-test-password-2026')
        assert browser.execute_script('return document.querySelector("form").checkValidity()')
        button=browser.find_element(By.CSS_SELECTOR,'button[type="submit"]')
        browser.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',button)
        wait.until(EC.element_to_be_clickable(button))
        button.click()
        wait.until(EC.visibility_of_element_located((By.NAME,'code')))
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,'.swal2-confirm'))).click()
        wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'.swal2-container')))
        assert not browser.find_element(By.ID,'password').is_displayed()
        browser.find_element(By.NAME,'code').send_keys('123456')
        button=browser.find_element(By.CSS_SELECTOR,'button[type="submit"]')
        browser.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',button)
        wait.until(EC.element_to_be_clickable(button))
        button.click()
        wait.until(lambda d: 'Phone verification UI passed.' in d.page_source)
        assert not browser.execute_script('return document.documentElement.scrollWidth>innerWidth')
        assert 'UI-test-password' not in browser.execute_script('return JSON.stringify(localStorage)+JSON.stringify(sessionStorage)')
    errors=[e for e in browser.get_log('browser') if e['level']=='SEVERE' and 'favicon' not in e['message'] and '/_vercel/insights/script.js' not in e['message']]
    if errors: print([entry['message'] for entry in errors])
    assert not errors, 'Browser reported errors'
    print('PASS: desktop/mobile signup, local phone input, OTP form transition, verification submission, no horizontal overflow or app errors (local Vercel analytics 404 excluded); no SMS sent')
except Exception:
    browser.save_screenshot('data/sms-ui-failure.png')
    raise
finally:
    browser.quit()
