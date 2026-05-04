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
    if (root.nodeType === Node.TEXT_NODE) {
        root = root.parentNode
        if (!root) return
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return
    if (root.closest?.("abbr")) return

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT, {
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
        const title = KEYWORDS.get(key)
        if (!title) continue

        if (match.index > last) frag.appendChild(
            document.createTextNode(
                src.slice(last, match.index)
            )
        )

        const abbr = document.createElement("abbr")
        abbr.title = title
        abbr.textContent = match[0]
        abbr.dataset.autoAbbr = "1"
        frag.appendChild(abbr)

        last = match.index + match[0].length
    }

    if (!frag.childNodes.length) return
    if (last < src.length)
        frag.appendChild(document.createTextNode(src.slice(last)))

    textNode.parentNode.replaceChild(frag, textNode)
}

function processMain() {
    const main = document.querySelector("main")
    if (main) processNode(main)
}

let mainObserver = null
function attachMainObserver(main) {
    if (mainObserver) mainObserver.disconnect()
    mainObserver = new MutationObserver(
        (mutations) => {
            for (const mut of mutations)
                for (const node of mut.addedNodes)
                    processNode(node)
        }
    )

    mainObserver.observe(main, { childList: true, subtree: true })
}

function handleAddedNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return

    if (node.tagName === "MAIN") {
        processNode(node)
        attachMainObserver(node)
        return
    }

    const inner = node.querySelector?.("main")
    if (inner) {
        processNode(inner)
        attachMainObserver(inner)
    }
}

const layoutObserver = new MutationObserver(
    (mutations) => {
        for (const mut of mutations)
            for (const node of mut.addedNodes)
                handleAddedNode(node)
    }
)

function init() {
    const mount = document.querySelector(".site-content") ?? document.body
    layoutObserver.observe(mount, { childList: true, subtree: false })

    if (mount !== document.body) layoutObserver.observe(
        document.body, {
        childList: true,
        subtree: false
    })

    const main = document.querySelector("main")
    if (main) {
        processNode(main)
        attachMainObserver(main)
    }
}


if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true })
else init()

// public api
window.abbr = {
    process: processMain,

}