"""Read-only checks of the final production build on localhost:3002."""
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

options = Options()
options.add_argument('--headless=new')
options.add_argument('--window-size=1440,1000')
options.add_argument('--disable-gpu')
options.set_capability('goog:loggingPrefs', {'browser':'ALL'})
driver = webdriver.Chrome(options=options)
driver.set_page_load_timeout(90)
wait = WebDriverWait(driver,60)
base = 'http://localhost:3002'
results = []
try:
    for path in ['/','/shop','/help','/login']:
        driver.get(base+path)
        wait.until(lambda d: len(d.find_elements(By.TAG_NAME,'h1')) == 1)
        driver.execute_async_script('document.fonts.ready.then(arguments[0])')
        assert not driver.execute_script('return performance.getEntriesByType("resource").some(r=>r.name.includes("fonts.googleapis.com")||r.name.includes("fonts.gstatic.com"))')
        assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth'), path+' desktop overflow'
        name = path.strip('/') or 'home'
        driver.save_screenshot(str(Path('design')/f'seo-{name}-desktop.png'))
        driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':390,'height':844,'deviceScaleFactor':1,'mobile':False})
        assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth'),path+' mobile overflow'
        driver.save_screenshot(str(Path('design')/f'seo-{name}-mobile.png'))
        driver.execute_cdp_cmd('Emulation.clearDeviceMetricsOverride', {})
        results.append(f'{path}: one H1, local fonts, desktop/mobile layout OK')
    driver.get(base+'/shop')
    link = wait.until(lambda d:d.find_element(By.CSS_SELECTOR,'a.product-name'))
    name = link.text
    driver.get(link.get_attribute('href'))
    wait.until(lambda d:d.find_element(By.TAG_NAME,'h1').text == name)
    wait.until(lambda d:d.execute_script('const i=document.querySelector(".product-page-image img"); return i && i.complete && i.naturalWidth>0'))
    assert '/_next/image?' in driver.find_element(By.CSS_SELECTOR,'.product-page-image img').get_attribute('src')
    driver.save_screenshot(str(Path('design')/'seo-product-desktop.png'))
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':390,'height':844,'deviceScaleFactor':1,'mobile':False})
    assert not driver.execute_script('return document.documentElement.scrollWidth > innerWidth'),'product mobile overflow'
    driver.save_screenshot(str(Path('design')/'seo-product-mobile.png'))
    driver.execute_cdp_cmd('Emulation.clearDeviceMetricsOverride', {})
    driver.get(driver.find_element(By.CSS_SELECTOR,'.product-page-grid .btn-primary-orange').get_attribute('href'))
    wait.until(lambda d:d.find_elements(By.CSS_SELECTOR,'dialog[open]'))
    results.append('Product: crawlable navigation, optimized image and purchase dialog deep-link OK')
    for path in ['/checkout','/customer','/dashboard','/hotel']:
        driver.get(base+path)
        wait.until(lambda d:'/login' in d.current_url)
        results.append(path+': logged-out browser redirected to login')
    errors = [r['message'] for r in driver.get_log('browser') if r['level']=='SEVERE']
    # Vercel's existing analytics endpoint is not available on a local Next server.
    unexpected = [r for r in errors if '/_vercel/insights/' not in r]
    Path('design/seo-browser-verification.txt').write_text('\n'.join(results+['Browser errors:']+errors),encoding='utf-8')
    assert not unexpected, '\n'.join(unexpected)
    print('PASS: public-page desktop/mobile rendering, local fonts, product images and navigation, private-page browser redirects.')
finally:
    driver.quit()
