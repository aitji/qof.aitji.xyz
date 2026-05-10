const KEYWORDS = Object.freeze(
    new Map([
        ["qof", "Quality of Feature"],
        ["qofs", "Quality of Features"],
        ["qol", "Quality of Life"],

        ["beta apis", "Experimental Application Programming Interfaces"],
        ["beta api", "Experimental Application Programming Interface"],

        ["json", "JavaScript Object Notation"],
    ])
)

function buildPattern(keywords) {
    const escaped = [...keywords.keys()]
        .sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi")
}

const PATTERN = buildPattern(KEYWORDS)
function processNode(root) {
    if (!root) return
    if (root.nodeType === Node.TEXT_NODE) root = root.parentNode
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return
    if (root.closest?.("abbr")) return

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (node.parentElement?.closest("abbr")) return NodeFilter.FILTER_REJECT
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT

            PATTERN.lastIndex = 0
            if (!PATTERN.test(node.nodeValue)) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        }
    })

    const nodes = []
    let n
    while ((n = walker.nextNode())) nodes.push(n)
    nodes.forEach(replaceInTextNode)
}

function replaceInTextNode(textNode) {
    PATTERN.lastIndex = 0
    const src = textNode.nodeValue
    const frag = document.createDocumentFragment()
    let last = 0, match

    while ((match = PATTERN.exec(src)) !== null) {
        const key = match[0].toLowerCase()
        const definition = KEYWORDS.get(key)
        if (!definition) continue
        if (match.index > last) frag.appendChild(document.createTextNode(src.slice(last, match.index)))
        const abbr = document.createElement("abbr")
        abbr.dataset.autoAbbr = "1"
        abbr.dataset.def = definition
        abbr.textContent = match[0]
        frag.appendChild(abbr)
        last = match.index + match[0].length
    }

    if (!frag.childNodes.length) return
    if (last < src.length) frag.appendChild(document.createTextNode(src.slice(last)))
    textNode.parentNode.replaceChild(frag, textNode)
}

function processMain() {
    const main = document.querySelector("main")
    if (main) processNode(main)
}

let mainObserver = null
function attachMainObserver(main) {
    if (mainObserver) mainObserver.disconnect()
    mainObserver = new MutationObserver((mutations) => {
        for (const mut of mutations)
            for (const node of mut.addedNodes) processNode(node)
    })
    mainObserver.observe(main, { childList: true, subtree: true })
}

function handleAddedNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (node.tagName === "MAIN") { processNode(node); attachMainObserver(node); return }
    const inner = node.querySelector?.("main")
    if (inner) { processNode(inner); attachMainObserver(inner) }
}

const layoutObserver = new MutationObserver((mutations) => {
    for (const mut of mutations)
        for (const node of mut.addedNodes) handleAddedNode(node)
})

function positionCard(card, targetRect) {
    const margin = 10
    const vw = window.innerWidth
    const vh = window.innerHeight

    card.classList.remove("arrow-bottom")
    const savedCss = card.style.cssText
    card.style.cssText = "visibility:hidden;display:block;left:0;top:0;padding-top:10px;padding-bottom:0"
    const cw = card.offsetWidth
    const ch = card.offsetHeight
    card.style.cssText = savedCss

    let top = targetRect.bottom
    let arrowBottom = false
    if (top + ch > vh - margin) { top = targetRect.top - ch; arrowBottom = true }
    top = Math.max(margin, Math.min(top, vh - ch - margin))

    let left = targetRect.left + targetRect.width / 2 - cw / 2
    left = Math.max(margin, Math.min(left, vw - cw - margin))

    card.style.left = left + "px"
    card.style.top = top + "px"
    if (arrowBottom) card.classList.add("arrow-bottom")

    const arrowEl = card.querySelector(".qof-card-arrow")
    const centre = targetRect.left + targetRect.width / 2 - left
    arrowEl.style.left = Math.max(10, Math.min(centre - 5, cw - 20)) + "px"
}

let abbrCard = null
let abbrCurrent = null
let abbrHideTimer = null

function getAbbrCard() {
    if (abbrCard) return abbrCard
    abbrCard = document.getElementById("abbr-card")
    abbrCard.removeAttribute("hidden")
    abbrCard.addEventListener("mouseenter", () => clearTimeout(abbrHideTimer))
    abbrCard.addEventListener("mouseleave", () => hideAbbrCard())
    return abbrCard
}

function showAbbrCard(abbr) {
    clearTimeout(abbrHideTimer)
    abbrCurrent = abbr
    const card = getAbbrCard()
    card.querySelector(".abbr-card-term").textContent = abbr.textContent
    card.querySelector(".abbr-card-def").textContent = abbr.dataset.def ?? abbr.title ?? ""
    positionCard(card, abbr.getBoundingClientRect())
    card.classList.add("is-visible")
}

function hideAbbrCard(delay = 120) {
    clearTimeout(abbrHideTimer)
    abbrHideTimer = setTimeout(() => {
        abbrCard?.classList.remove("is-visible")
        abbrCurrent = null
    }, delay)
}

let linkCard = null
let linkCurrent = null
let linkHideTimer = null
let linkShowTimer = null
let routeMap = null

function ensureRouteMap() {
    if (routeMap) return
    const routes = window.router?.allRoutes
    if (!routes?.length) return
    routeMap = new Map(routes.map(r => [r.slug, r.title]))
}

function getLinkCard() {
    if (linkCard) return linkCard
    linkCard = document.getElementById("int-link-card")
    linkCard.removeAttribute("hidden")
    linkCard.addEventListener("mouseenter", () => clearTimeout(linkHideTimer))
    linkCard.addEventListener("mouseleave", () => hideLinkCard())
    return linkCard
}

function showLinkCard(anchor) {
    clearTimeout(linkHideTimer)
    clearTimeout(linkShowTimer)
    ensureRouteMap()

    const href = anchor.getAttribute("href")
    if (!href) return
    if (/^(https?:)?\/\//i.test(href) || href.startsWith("#") || href.startsWith("mailto:")) return

    const slug = href.replace(/\/$/, "") || "/"
    const title = routeMap?.get(slug)
    if (!title) return

    linkCurrent = anchor
    linkShowTimer = setTimeout(() => {
        const card = getLinkCard()
        card.querySelector(".link-card-title").textContent = title
        card.querySelector(".link-card-slug").textContent = slug
        positionCard(card, anchor.getBoundingClientRect())
        card.classList.add("is-visible")
    }, 160)
}

function hideLinkCard(delay = 100) {
    clearTimeout(linkShowTimer)
    clearTimeout(linkHideTimer)
    linkHideTimer = setTimeout(() => {
        linkCard?.classList.remove("is-visible")
        linkCurrent = null
    }, delay)
}

let extCard = null
let extCurrent = null
let extHideTimer = null
let extShowTimer = null

const SITE_ORIGIN = location.origin

function isExternal(href) {
    try { return new URL(href, location.href).origin !== SITE_ORIGIN }
    catch { return false }
}

function getExtCard() {
    if (extCard) return extCard
    extCard = document.getElementById("ext-link-card")
    extCard.removeAttribute("hidden")
    extCard.addEventListener("mouseenter", () => clearTimeout(extHideTimer))
    extCard.addEventListener("mouseleave", () => hideExtCard())
    return extCard
}


function showExtCard(anchor) {
    clearTimeout(extHideTimer)
    clearTimeout(extShowTimer)

    const href = anchor.getAttribute("href")
    if (!href) return
    if (!isExternal(href)) return

    extCurrent = anchor
    extShowTimer = setTimeout(() => {
        let parsed
        try { parsed = new URL(anchor.href) }
        catch { return }

        const domain = parsed.hostname
        const path = (parsed.pathname + parsed.search).replace(/\/$/, "") || "/"
        const shortPath = path.length > 48 ? path.slice(0, 46) + "..." : path

        const card = getExtCard()
        card.querySelector(".ext-card-domain").textContent = domain
        card.querySelector(".ext-card-path").textContent = shortPath === '/' ? '' : shortPath
        positionCard(card, anchor.getBoundingClientRect())
        card.classList.add("is-visible")
    }, 200)
}

function hideExtCard(delay = 100) {
    clearTimeout(extShowTimer)
    clearTimeout(extHideTimer)
    extHideTimer = setTimeout(() => {
        extCard?.classList.remove("is-visible")
        extCurrent = null
    }, delay)
}

function attachEvents() {
    const body = document.body

    // abbr hover
    body.addEventListener("mouseenter", (e) => {
        const abbr = e.target.closest?.("abbr[data-auto-abbr], abbr[title]")
        if (abbr) showAbbrCard(abbr)
    }, true)
    body.addEventListener("mouseleave", (e) => {
        const abbr = e.target.closest?.("abbr[data-auto-abbr], abbr[title]")
        if (abbr) hideAbbrCard()
    }, true)

    // link hover
    body.addEventListener("mouseenter", (e) => {
        const a = e.target.closest?.("main a[href]")
        if (!a) return
        if (isExternal(a.getAttribute("href") ?? "")) showExtCard(a)
        else showLinkCard(a)
    }, true)
    body.addEventListener("mouseleave", (e) => {
        const a = e.target.closest?.("main a[href]")
        if (!a) return
        if (isExternal(a.getAttribute("href") ?? "")) hideExtCard()
        else hideLinkCard()
    }, true)

    // abbr tap
    body.addEventListener("touchstart", (e) => {
        const abbr = e.target.closest?.("abbr[data-auto-abbr], abbr[title]")
        if (!abbr) return
        if (abbrCurrent === abbr && abbrCard?.classList.contains("is-visible")) {
            hideAbbrCard(0); abbr.classList.remove("abbr-active"); e.preventDefault(); return
        }
        abbrCurrent?.classList.remove("abbr-active")
        abbr.classList.add("abbr-active")
        showAbbrCard(abbr)
        e.preventDefault()
    }, { passive: false, capture: true })

    // tap outside
    document.addEventListener("touchstart", (e) => {
        if (!abbrCurrent) return
        if (abbrCard?.contains(e.target) || e.target.closest?.("abbr[data-auto-abbr], abbr[title]")) return
        abbrCurrent.classList.remove("abbr-active")
        hideAbbrCard(0)
    }, { passive: true })

    // reposition
    const reposition = () => {
        if (abbrCurrent && abbrCard?.classList.contains("is-visible"))
            positionCard(abbrCard, abbrCurrent.getBoundingClientRect())
        if (linkCurrent && linkCard?.classList.contains("is-visible"))
            positionCard(linkCard, linkCurrent.getBoundingClientRect())
        if (extCurrent && extCard?.classList.contains("is-visible"))
            positionCard(extCard, extCurrent.getBoundingClientRect())
    }
    window.addEventListener("scroll", reposition, { passive: true, capture: true })
    window.addEventListener("resize", reposition, { passive: true })

    // escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideAbbrCard(0)
            hideLinkCard(0)
            hideExtCard(0)
        }
    })
}

function dismissAllCards() {
    hideAbbrCard(0)
    hideLinkCard(0)
    hideExtCard(0)

    abbrCurrent?.classList.remove("abbr-active")
    abbrCurrent = null
    linkCurrent = null
    extCurrent = null
}

function attachRouteListener() {
    const originalScrollTo = window.scrollTo
    window.scrollTo = function (...args) {
        dismissAllCards()
        originalScrollTo.apply(window, args)
    }
}

function init() {
    const mount = document.querySelector(".site-content") ?? document.body
    layoutObserver.observe(mount, { childList: true, subtree: false })
    if (mount !== document.body)
        layoutObserver.observe(document.body, { childList: true, subtree: false })

    const main = document.querySelector("main")
    if (main) { processNode(main); attachMainObserver(main) }

    attachEvents()
    attachRouteListener()
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true })
else init()

// public api
window.abbr = {
    process: processMain,

}