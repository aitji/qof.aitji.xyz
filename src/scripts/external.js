(function () {
    'use strict'

    const SITE_ORIGIN = location.origin
    const MODAL_ID = 'ext-redirect-modal'
    const DELAY_MS = 8 * 1000

    let _targetUrl = ''
    let _timer = null
    let _lastFocused = null

    const modal = document.getElementById(MODAL_ID)
    const urlEl = document.getElementById('ext-modal-url')
    const progress = document.getElementById('ext-modal-progress')
    const cancelBtn = document.getElementById('ext-modal-cancel')
    const closeBtn = document.getElementById('ext-modal-close')
    const goBtn = document.getElementById('ext-modal-go')
    const backdrop = modal?.querySelector('.ext-modal-backdrop')

    function openModal(url) {
        if (!modal) return

        _targetUrl = url
        _lastFocused = document.activeElement

        try {
            const parsed = new URL(url)
            urlEl.textContent =
                parsed.hostname +
                parsed.pathname.replace(/\/$/, '') +
                parsed.search
        } catch {
            urlEl.textContent = url
        }

        modal.removeAttribute('inert')
        modal.classList.add('is-open')

        progress.classList.remove('counting')
        progress.style.transform = 'scaleX(1)'
        void progress.offsetWidth
        progress.classList.add('counting')
        progress.style.transitionDuration = DELAY_MS + 'ms'
        progress.style.transform = 'scaleX(0)'

        clearTimeout(_timer)
        _timer = setTimeout(redirect, DELAY_MS)

        requestAnimationFrame(() => cancelBtn?.focus())
        document.addEventListener('keydown', trapFocus)
    }

    function closeModal() {
        if (!modal) return

        clearTimeout(_timer)
        document.removeEventListener('keydown', trapFocus)
        modal.classList.remove('is-open')
        modal.setAttribute('inert', '')
        _lastFocused?.focus()
    }

    function redirect() {
        closeModal()
        window.open(_targetUrl, '_blank', 'noopener,noreferrer')
    }

    function trapFocus(e) {
        if (e.key === 'Escape') return closeModal()
        if (e.key !== 'Tab') return

        const focusable = [...modal.querySelectorAll(
            'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )].filter(el => !el.closest('[inert]'))

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    }

    function bindModalEvents() {
        backdrop?.addEventListener('click', closeModal)
        closeBtn?.addEventListener('click', closeModal)
        cancelBtn?.addEventListener('click', closeModal)
        goBtn?.addEventListener('click', redirect)
    }

    function isExternal(href) {
        try {
            return new URL(href, location.href).origin !== SITE_ORIGIN
        } catch {
            return false
        }
    }

    function handleClick(e) {
        const anchor = e.target.closest('a[href]')
        if (!anchor) return

        const href = anchor.getAttribute('href')
        if (!href) return
        if (href[0] === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return
        if (!isExternal(href)) return
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return

        e.preventDefault()
        openModal(anchor.href)
    }

    function init() {
        if (!modal) return
        bindModalEvents()
        document.addEventListener('click', handleClick)
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', init)
        : init()
})()