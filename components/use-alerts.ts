'use client'

import Swal from 'sweetalert2/dist/sweetalert2.js'
import type { SweetAlertOptions } from 'sweetalert2'
import { useLanguage } from './language-provider'

export function useAlerts() {
  const { t } = useLanguage()
  async function fire(options: SweetAlertOptions) {
    // Let React finish closing/opening a form before choosing the popup's parent.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    return Swal.fire({
      // Native modal dialogs occupy the browser's top layer. Keep alerts inside it.
      target: document.querySelector<HTMLDialogElement>('dialog[open]') || document.body,
      confirmButtonColor: '#ff5405',
      cancelButtonColor: '#59665e',
      confirmButtonText: t('OK', 'Sawa'),
      cancelButtonText: t('Cancel', 'Ghairi'),
      closeButtonAriaLabel: t('Close', 'Funga'),
      customClass: { popup: 'nungwi-alert' },
      heightAuto: false,
      keydownListenerCapture: true,
      ...options,
    })
  }
  return {
    success: (message: string, toast = true) => fire({
      icon: 'success',
      titleText: toast ? t(message) : t('Success', 'Imefanikiwa'),
      text: toast ? undefined : t(message),
      toast,
      position: toast ? 'top-end' : 'center',
      showConfirmButton: !toast,
      showCloseButton: toast,
      timer: toast ? 4500 : undefined,
      timerProgressBar: toast,
      didOpen: popup => {
        if (toast) {
          popup.addEventListener('mouseenter', Swal.stopTimer)
          popup.addEventListener('mouseleave', Swal.resumeTimer)
          popup.addEventListener('focusin', Swal.stopTimer)
          popup.addEventListener('focusout', Swal.resumeTimer)
        }
      },
    }),
    error: (message: string) => fire({ icon: 'error', titleText: t('Unable to complete this action', 'Imeshindikana kukamilisha hatua hii'), text: t(message) }),
    confirm: async (message: string) => (await fire({
      icon: 'warning',
      titleText: t('Please confirm', 'Tafadhali thibitisha'),
      text: t(message),
      showCancelButton: true,
      confirmButtonText: t('Continue', 'Endelea'),
      focusCancel: true,
    })).isConfirmed,
  }
}
