(function () {
    'use strict'

    const locale = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().locale }
        catch { return undefined }
    })()
    const zone = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' }
        catch { return '' }
    })()

    const fmt = (opts) => { try { return new Intl.DateTimeFormat(locale, opts) } catch { return new Intl.DateTimeFormat('en-US', opts) } }
    const short = fmt({ dateStyle: 'medium', timeStyle: 'short' })
    const full = fmt({ dateStyle: 'full', timeStyle: 'long' })
    const tzShort = fmt({ timeZoneName: 'short' })
    let rtf = null
    try { rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }) } catch { }

    const UNITS = [
        ['year', 31536000], ['month', 2592000], ['week', 604800],
        ['day', 86400], ['hour', 3600], ['minute', 60]
    ]

    function relative(ms) {
        if (!rtf) return ''
        const diff = Math.round((ms - Date.now()) / 1000)
        const abs = Math.abs(diff)
        if (abs < 45) return rtf.format(0, 'second')
        for (const [unit, secs] of UNITS)
            if (abs >= secs || unit === 'minute')
                return rtf.format(Math.round(diff / secs), unit)

        return ''
    }

    const tzName = (date) => {
        const part = tzShort.formatToParts(date).find(p => p.type === 'timeZoneName')
        return part ? part.value : ''
    }

    function render(el) {
        const ts = Number(el.dataset.ts)
        if (!Number.isFinite(ts)) return

        const date = new Date(ts * 1000)
        if (isNaN(date)) return

        const label = short.format(date)
        const inCell = !!el.closest('td, th')
        const rel = relative(date.getTime())

        const lines = [
            full.format(date),
            `/UTC ${date.toISOString().slice(0, 16).replace('T', ' ')}`
        ].filter(Boolean)

        let abbr = el.querySelector('abbr')
        if (!abbr) {
            abbr = document.createElement('abbr')
            abbr.dataset.autoAbbr = '1'
            el.textContent = ''
            el.appendChild(abbr)
        }

        abbr.textContent = label
        abbr.dataset.def = lines.join('\n')
        el.removeAttribute('title')
        el.dateTime = date.toISOString()

        let note = el.querySelector('.time-rel')
        if (!inCell && rel) {
            if (!note) {
                note = document.createElement('span')
                note.className = 'time-rel'
                el.appendChild(note)
            }
            note.textContent = ` (${rel})`
        } else if (note) note.remove()
    }

    function apply(root) {
        const scope = root || document
        scope.querySelectorAll('time[data-ts]').forEach(render)

        const first = scope.querySelector('time[data-ts]')
        if (first) {
            const name = tzName(new Date(Number(first.dataset.ts) * 1000))
            scope.querySelectorAll('.tz-label').forEach(el => el.textContent = name ? `(${name})` : '(local time)')
        }
    }

    window.QoFTime = { apply }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply())
    else apply()
})()
