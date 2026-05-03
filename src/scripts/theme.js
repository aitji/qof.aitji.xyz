const THEME_KEY = 'site-theme-preference'
const themes = { LIGHT: 'light', DARK: 'dark' }

function getCookie(n) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]+)'))
    return m ? decodeURIComponent(m[1]) : null
}

function setCookie(n, v) {
    document.cookie = n + '=' + encodeURIComponent(v) + '; Domain=.aitji.xyz; Path=/; Max-Age=31536000; SameSite=Lax'
}

function getThemePreference() {
    return getCookie(THEME_KEY) || themes.LIGHT
}

function setThemePreference(t) {
    if (Object.values(themes).includes(t)) {
        setCookie(THEME_KEY, t)
        applyTheme(t)
    }
}

function applyTheme(t) {
    const e = document.documentElement
    if (t === themes.DARK) {
        e.setAttribute('data-theme', 'dark')
        e.style.colorScheme = 'dark'
    } else {
        e.setAttribute('data-theme', 'light')
        e.style.colorScheme = 'light'
    }
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: t } }))
}

applyTheme(getThemePreference())

window.getThemePreference = getThemePreference
window.getEffectiveTheme = getThemePreference // dupe

window.setThemePreference = setThemePreference