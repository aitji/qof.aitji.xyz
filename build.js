import fs from 'fs'
import path from 'path'
import ignore from 'ignore'
import { build } from 'esbuild'
import { minify as minifyHTML } from 'html-minifier-terser'
import { minify as minifyJS } from 'terser'

const ig = ignore()
if (fs.existsSync('.gitignore')) ig.add(fs.readFileSync('.gitignore', 'utf8'))

const SRC = 'src'
const OUT = 'public'
const SITE = 'https://qof.aitji.xyz'
const SITE_TITLE = 'QoF Wiki'
const TEMPLATE = 'index.html'
const WATCH = process.argv.includes('--watch')
// if (!WATCH) ig.add('dev/')

const ensure = p => fs.mkdirSync(p, { recursive: true })

const headTag = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-3H6MXMVZPG"></script><script>function gtag(){dataLayer.push(arguments)}window.dataLayer=window.dataLayer||[],gtag("js",new Date),gtag("config","G-3H6MXMVZPG");</script>'
const bodyTag = ''
const bannerText = `
                          ,
   ,-.       _,---._ __  / \\
  /  )    .-'       \`./ /   \\
 (  (   ,'            \`/    /|
  \\  \`-"             \\'\\   / |
   \`.              ,  \\ \\ /  |
    /\`.          ,'-\`----Y   |
   (            ;        |   '
   |  ,-.    ,-'         |  /
   |  | (   |            | /
   )  |  \\  \`.___________|/
   \`--'   \`--'

    QoF™
    Copyright (c) 2026 aitji & pickerth-12 Licensed under the MIT License
    Source: github.com/aitji/QoF
`

const banner = {
    html: `<!--${bannerText}-->\n`,
    js: '', // /**${bannerText}*/\n
    css: '' // /*${bannerText}*/\n
}

// time ssg
const FALLBACK_TZ = 'Asia/Bangkok'
const FALLBACK_LABEL = 'GMT+7'
const fallbackFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: FALLBACK_TZ, year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})

const stampTimes = html => html.replace(
    /<time\b[^>]*?\bdata-ts=["']?(\d+)["']?[^>]*>[\s\S]*?<\/time>/gi,
    (_, ts) => {
        const date = new Date(Number(ts) * 1000)
        if (isNaN(date)) throw new Error(`bad <time data-ts="${ts}">`)
        return `<time data-ts="${ts}" datetime="${date.toISOString()}">${fallbackFmt.format(date)} ${FALLBACK_LABEL}</time>`
    }
)

const minifyJSONFile = async file => {
    try {
        if (!fs.existsSync(file)) throw new Error(`file not found: ${file}`)

        const src = fs.readFileSync(file, 'utf8')
        const out = JSON.stringify(JSON.parse(src))
        fs.writeFileSync(file, out)
    } catch (error) { console.error(`[JSON] error processing ${file}: ${error.message}`) }
}

const minifyHTMLFile = async file => {
    try {
        let src = fs.readFileSync(file, 'utf8')
        const isFragment = file.includes('docs')
        if (!WATCH) {
            if (headTag) src = src.replace('</head>', `${headTag}</head>`)
            if (bodyTag) src = src.replace('</body>', `${bodyTag}</body>`)
        }
        if (isFragment) src = stampTimes(src)

        // <script type="application/ld+json">{"@context": "https://schema.org"...}</script>
        const regex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i
        const match = src.match(regex)

        if (match) {
            const jsonSrc = match[1]
            const jsonOut = JSON.stringify(JSON.parse(jsonSrc))
            src = src.replace(jsonSrc, jsonOut)
        }

        let out = await minifyHTML(src, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeEmptyAttributes: true,
            minifyCSS: true,
            minifyJS: true,
            keepClosingSlash: true,
            html5: true
        })

        if (isFragment) fs.writeFileSync(file, out)
        else fs.writeFileSync(file, banner.html + out)
    } catch (error) {
        console.error(`[HTML] error processing ${file}: ${error.message}`)
        try { if (file.includes('docs')) fs.writeFileSync(file, stampTimes(fs.readFileSync(file, 'utf8'))) } catch { }
    }
}

const minifyJSFile = async (src, out) => {
    try {
        const code = fs.readFileSync(src, 'utf8')
        let r = await minifyJS(code, {
            compress: {
                passes: 3,
                drop_console: true,
                unsafe: true
            },
            mangle: { toplevel: false },
            format: { comments: false }
        })

        if (WATCH) r.code = r.code.replaceAll('Domain=.aitji.xyz; ', '')
        fs.writeFileSync(out, banner.js + r.code)
    } catch (error) { console.error(`[JS] error processing ${src}: ${error.message}`) }
}

const processFile = async (src, out) => {
    ensure(path.dirname(out))

    if (src.endsWith('.html')) {
        fs.copyFileSync(src, out)
        await minifyHTMLFile(out)
        return
    }

    if (src.endsWith('.js')) {
        await minifyJSFile(src, out)
        return
    }

    if (src.endsWith('.css')) {
        try {
            await build({
                entryPoints: [src],
                outfile: out,
                minify: true,
                legalComments: 'none',
                banner: { css: banner.css }
            })
        } catch (error) { console.error(`[CSS] error processing ${src}: ${error.message}`) }
        return
    }

    fs.copyFileSync(src, out)
    if (src.endsWith('.json')) await minifyJSONFile(out)
}

const isTemplate = rel => rel === TEMPLATE
const srcToOut = src => path.join(OUT, path.relative(SRC, src).replace(/\\/g, '/'))
const walk = async dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const src = path.join(dir, e.name)
        const rel = path.relative(SRC, src).replace(/\\/g, '/')
        if (ig.ignores(rel) || isTemplate(rel)) continue

        const out = srcToOut(src)

        if (e.isDirectory()) {
            ensure(out)
            await walk(src)
            continue
        }

        await processFile(src, out)
    }
}

const copyRoot = (name, output = OUT) => {
    if (!fs.existsSync(name)) return
    fs.cpSync(name, path.join(output, name), { recursive: true })
}

// ssg
const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const routeFile = slug => slug === '/'
    ? path.join(OUT, 'index.html')
    : path.join(OUT, slug.replace(/^\//, '') + '.html')
const routeURL = slug => slug === '/' ? SITE : SITE + slug

const flatten = (routes, parents = [], list = []) => {
    for (const r of routes) {
        list.push({ ...r, parents })
        if (r.pages?.length) flatten(r.pages, [...parents, r], list)
    }
    return list
}

const countRoutes = routes => routes.reduce((n, r) => n + 1 + countRoutes(r.pages ?? []), 0)
const renderNav = (routes, current, ancestors, depth = 0) => {
    const items = routes.map(r => {
        const kids = r.pages?.length ? r.pages : null
        const isActive = r.slug === current
        const open = kids && (ancestors.has(r.slug) || isActive)
        const cls = ['nav-item', kids && 'has-children', open && 'open'].filter(Boolean).join(' ')
        const link = `<a class="nav-link${isActive ? ' active' : ''}" href="${esc(r.slug)}" data-slug="${esc(r.slug)}" data-path="${esc(r.path ?? '')}"${isActive ? ' aria-current="page"' : ''}><span class="nav-link-text">${esc(r.title)}</span></a>`
        const extra = kids
            ? `<span class="nav-badge">${kids.length}</span><button class="nav-chevron" aria-label="Toggle ${esc(r.title)}" aria-hidden="true" tabindex="-1"></button>`
            : ''
        const sub = kids ? renderNav(kids, current, ancestors, depth + 1) : ''
        return `<li class="${cls}" data-slug="${esc(r.slug)}"><div class="nav-row">${link}${extra}</div>${sub}</li>`
    }).join('')
    return `<ul class="nav-list ${depth === 0 ? 'nav-root' : 'nav-children'}">${items}</ul>`
}

const plain = html => html
    .replace(/<sup\b[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim()

const clip = (text, max = 160) => {
    if (text.length <= max) return text
    const cut = text.slice(0, max - 1)
    return cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:.-]+$/, '') + '…'
}

const describe = (route, html, fallback) => {
    if (route.description) return route.description
    if (route.slug === '/') return fallback

    const body = html.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    const cl = body.search(/<h2 id=["']?changelog/i)
    if (cl >= 0) {
        const li = body.slice(cl).match(/<li[^>]*>([\s\S]*?)<\/li>/i)
        if (li && plain(li[1])) return clip(`${route.title} release notes: ${plain(li[1])}`)
    }

    for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
        const text = plain(m[1])
        if (text.length >= 50) return clip(text)
    }
    return `${route.title} – ${SITE_TITLE}`
}

const replaceTag = (src, pattern, replacement, label) => {
    if (!pattern.test(src)) throw new Error(`[ssg] template tag missing: ${label}`)
    return src.replace(pattern, () => replacement)
}

const setMeta = (html, attr, name, value) => replaceTag(
    html,
    new RegExp(`<meta\\s+${attr}="${name}"\\s+content="[^"]*"\\s*/?>`, 'i'),
    `<meta ${attr}="${name}" content="${esc(value)}">`,
    `${attr}=${name}`
)

const ldJSON = (route, title, description) => {
    const crumbs = [{ name: 'Home', slug: '/' }, ...route.parents, route]
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'TechArticle',
                headline: title,
                description,
                inLanguage: 'en',
                url: routeURL(route.slug),
                isPartOf: { '@type': 'WebSite', name: 'Quality of Feature', url: SITE },
                author: { '@type': 'Person', name: 'aitji', url: 'https://aitji.xyz' }
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: crumbs.map((c, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    name: c.title ?? c.name,
                    item: routeURL(c.slug)
                }))
            }
        ]
    })
}

const lastmodOf = html => {
    const stamps = [...html.matchAll(/data-ts="?(\d+)/g)].map(m => Number(m[1]))
    return stamps.length ? new Date(Math.max(...stamps) * 1000).toISOString().slice(0, 10) : ''
}

const sitemapXML = pages => {
    const rows = pages.filter(p => p.indexable).map(p => `<url><loc>${routeURL(p.slug)}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`).join('')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`
}

const readFragment = p => {
    const file = path.join(OUT, p.replace(/^\//, ''))
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
}

const genSSG = async () => {
    const config = JSON.parse(fs.readFileSync(path.join(SRC, 'routes.json'), 'utf8'))
    const route = flatten(config.routes)
    const temp = fs.readFileSync(path.join(SRC, TEMPLATE), 'utf8')
    const count = countRoutes(config.routes)

    const baseTitle = temp.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
    const baseDesc = temp.match(/<meta name="description"\s+content="([^"]*)"/i)?.[1]
    if (!baseTitle || !baseDesc) throw new Error('[ssg] template is missing <title> or meta description')

    const stub = readFragment('/418.html')
    if (!stub) throw new Error('[ssg] 418.html fragment missing (needed for pages without docs)')

    const pages = []
    const missing = []

    for (const routes of route) {
        let content = routes.path ? readFragment(routes.path) : null
        const hasDoc = content !== null
        if (!hasDoc) {
            content = stub
            missing.push(routes.slug)
        }

        const isHome = routes.slug === '/'
        const title = isHome ? baseTitle : `${routes.title} – ${SITE_TITLE}`
        const description = hasDoc ? describe(routes, content, baseDesc) : `${routes.title} is still being written. Check back soon.`
        const canonical = routeURL(routes.slug)
        const ancestors = new Set(routes.parents.map(p => p.slug))

        let html = temp
        html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`, 'title')
        html = setMeta(html, 'name', 'description', description)
        html = setMeta(html, 'property', 'og:title', isHome ? 'Quality of Feature' : title)
        html = setMeta(html, 'property', 'og:description', description)
        html = setMeta(html, 'property', 'og:url', canonical)
        html = replaceTag(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}">`, 'canonical')
        if (!hasDoc) html = setMeta(html, 'name', 'robots', 'noindex, follow')
        if (!isHome && hasDoc) html = replaceTag(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${ldJSON(routes, title, description)}</script>`, 'ld+json')
        if (!isHome && hasDoc) html = replaceTag(html, /<meta property="og:type" content="[^"]*">/i, '<meta property="og:type" content="article">', 'og:type')

        html = replaceTag(html, /<body>/i, `<body data-route="${esc(routes.slug)}">`, 'body')
        html = replaceTag(html, /<!--ssg:count-->/, String(count), 'count')
        html = replaceTag(html, /<!--ssg:nav-->/, renderNav(config.routes, routes.slug, ancestors), 'nav')
        html = replaceTag(html, /<!--ssg:content-->/, content, 'content')

        const file = routeFile(routes.slug)
        ensure(path.dirname(file))
        fs.writeFileSync(file, html)
        await minifyHTMLFile(file)

        pages.push({ slug: routes.slug, file, hasDoc, indexable: hasDoc, lastmod: hasDoc ? lastmodOf(content) : '' })
    }

    fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemapXML(pages))
    validateSSG(pages, route)

    console.log(`[ssg] prerendered ${pages.length} routes (${pages.length - missing.length} with docs, ${missing.length} placeholders)`)
}

const validateSSG = (pages, routes) => {
    const known = new Set(routes.map(r => r.slug))
    const dead = new Map()

    for (const page of pages) {
        const html = fs.readFileSync(page.file, 'utf8')
        if (html.includes('<!--ssg:')) throw new Error(`[ssg] unfilled placeholder: ${page.slug}`)
        if (!html.includes(`href=${routeURL(page.slug)}`) && !html.includes(`href="${routeURL(page.slug)}"`))
            throw new Error(`[ssg] canonical URL missing: ${page.slug}`)
        if (!/id="?main-content"?[^>]*>\s*<\w/.test(html)) throw new Error(`[ssg] empty content: ${page.slug}`)
        if (!/class="?nav-link active/.test(html)) throw new Error(`[ssg] sidebar has no active item: ${page.slug}`)

        for (const m of html.matchAll(/<a\s[^>]*?href=["']?(\/w\/[^"'\s>#]*)/g)) {
            const target = m[1].replace(/\/$/, '')
            if (!known.has(target)) dead.set(target, page.slug)
        }
    }

    const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8')
    for (const p of pages.filter(p => p.indexable))
        if (!sitemap.includes(`<loc>${routeURL(p.slug)}</loc>`)) throw new Error(`[ssg] sitemap route missing: ${p.slug}`)

    for (const [target, from] of dead) console.warn(`[ssg] warning: ${from} links to unknown page ${target}`)
}

const startWatch = () => {
    console.log(`[watch] Watching ${SRC}/ for changes...`)
    const timers = new Map()
    let ssgTimer = null
    const queueSSG = () => {
        clearTimeout(ssgTimer)
        ssgTimer = setTimeout(() => genSSG().catch(e => console.error('[ssg]', e.message)), 150)
    }

    fs.watch(SRC, { recursive: true }, (event, filename) => {
        if (!filename) return

        const rel = filename.replace(/\\/g, '/')
        if (ig.ignores(rel)) return

        const src = path.join(SRC, rel)
        const out = path.join(OUT, rel)

        if (timers.has(src)) clearTimeout(timers.get(src))
        timers.set(src, setTimeout(async () => {
            timers.delete(src)

            if (!fs.existsSync(src)) { // file del
                if (!isTemplate(rel) && fs.existsSync(out)) {
                    try {
                        fs.rmSync(out, { recursive: true, force: true })
                        console.log(`[watch] deleted: ${out}`)
                    } catch (e) { console.error(`[watch] failed to delete ${out}:`, e.message) }
                }
                return queueSSG()
            }

            if (fs.statSync(src).isDirectory()) {
                ensure(out)
                console.log(`[watch] dir created: ${out}`)
                return
            }

            try {
                if (!isTemplate(rel)) await processFile(src, out)
                queueSSG()
                console.log(`[watch] ${event === 'rename' ? 'Created' : 'Updated'}: ${src}`)
            } catch (e) { console.error(`[watch] Error processing ${src}:`, e.message) }
        }, 100))
    })
}

(async () => {
    if (!WATCH) { // clean build
        fs.rmSync(OUT, { recursive: true, force: true })
        ensure(OUT)
    } else ensure(OUT) // watch: ensure output exists, don't wipe it 

    await walk(SRC)
    copyRoot('img')
    await genSSG()

    if (WATCH) startWatch()
    else console.log('Build complete.')
})().catch(e => {
    console.error(e)
    process.exitCode = 1
})
