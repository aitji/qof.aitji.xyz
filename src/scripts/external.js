(function () {
    'use strict'

    const SITE_ORIGIN = location.origin
    function isExternal(href) {
        try { return new URL(href, location.href).origin !== SITE_ORIGIN }
        catch { return false }
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
        window.open(anchor.href, '_blank', 'noopener,noreferrer')
    }

    const init = () => document.addEventListener('click', handleClick)
    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', init)
        : init()
})()