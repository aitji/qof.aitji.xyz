(function () {
    'use strict'
    const ROUTES_URL = '/routes.json'
    const SITE_TITLE = 'QoF Wiki'
    const CACHE_VERSION = (() => {
        try { return localStorage.getItem('router-version') || '' }
        catch { return '' }
    })()

    const progress = {
        el: null,
        _t: null,

        init() { this.el = document.getElementById('progress-bar') },
        _set(w, transition) {
            if (!this.el) return
            this.el.style.transition = transition || ''
            this.el.style.width = w + '%'
        },
        start() {
            if (!this.el) return
            clearTimeout(this._t)

            this._set(0, 'none')
            this.el.style.opacity = '1'
            this.el.style.background = ''
            void this.el.offsetWidth

            this._set(25, 'width 200ms ease')
            this._t = setTimeout(() => {
                this._set(55, 'width 600ms ease')
                this._t = setTimeout(() => {
                    this._set(75, 'width 800ms ease')
                }, 600)
            }, 200)
        },

        done() {
            if (!this.el) return
            clearTimeout(this._t)

            this._set(100, 'width 150ms ease')
            this._t = setTimeout(() => {
                this.el.style.transition = 'opacity 250ms ease'
                this.el.style.opacity = '0'
            }, 200)
        },

        error() {
            if (!this.el) return
            clearTimeout(this._t)
            this.el.style.background = '#f85149'
            this._set(100, 'width 100ms ease')

            this._t = setTimeout(() => {
                this.el.style.transition = 'opacity 250ms ease'
                this.el.style.opacity = '0'
                this._t = setTimeout(() => {
                    this.el.style.background = ''
                }, 300)
            }, 200)
        },
    }

    const router = {
        contentEl: null,
        currentSlug: null,
        allRoutes: [],
        cache: new Map(),
        _routesLoaded: false,

        async init() {
            this.contentEl = document.getElementById('main-content')
            if (!this.contentEl) {
                console.error('[router] #main-content not found')
                return
            }

            let config // load data
            try {
                const res = await fetch(ROUTES_URL + (CACHE_VERSION ? '?v=' + CACHE_VERSION : ''))
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                config = await res.json()
                this._routesLoaded = true
            } catch (err) {
                console.error('[router] failed to load routes.json:', err)
                this.contentEl.innerHTML = this._errorHTML('Could not load navigation', 'Make sure routes.json exists.')
                return
            }

            this._rootRoutes = config.routes
            this._flattenRoutes(config.routes)
            buildSidebar(config.routes)

            window.addEventListener('popstate', () => { this._navigateTo(window.location.pathname, false) })
            this.contentEl.addEventListener('click', (e) => {
                const a = e.target.closest('a[href]')
                if (!a) return
                const href = a.getAttribute('href')
                if (!href || /^(https?:)?\/\//i.test(href) || href.startsWith('#') || href.startsWith('mailto:')) return
                const route = this._findBySlug(href)
                if (route) {
                    e.preventDefault()
                    this._navigateTo(href)
                }
            })

            this._navigateTo(window.location.pathname, false)
        },

        // route helpers
        _flattenRoutes(routes) {
            for (const r of routes) {
                this.allRoutes.push(r)
                if (r.pages?.length) this._flattenRoutes(r.pages)
            }
        },

        _findBySlug(slug) {
            slug = slug.replace(/\/$/, '') || '/'
            return this.allRoutes.find(r => r.slug === slug) ?? null
        },

        // nav stuff
        async _navigateTo(slug, pushHistory = true) {
            slug = slug.replace(/\/$/, '') || '/'

            if (this.currentSlug === slug) return
            this.currentSlug = slug

            const route = this._findBySlug(slug)

            if (!route) {
                console.warn(`[router] unknown slug "${slug}"`)
                window.location.href = slug
                return
            }

            // history
            if (pushHistory && window.location.pathname !== slug)
                history.pushState({ slug }, route.title ?? '', slug)

            document.title = route.title ? `${route.title} – ${SITE_TITLE}` : SITE_TITLE
            syncActive(slug)

            const filePath = route.path
            if (!filePath || filePath === '/') {
                this.contentEl.innerHTML = ''
                return
            }

            progress.start()
            try {
                const html = await this._loadHTML(filePath)
                this._render(html)
                progress.done()
            } catch (err) {
                console.error(`[router] failed to load "${filePath}":`, err)
                progress.error()

                const html = await this._loadHTML("/418.html")
                this._render(html)
            }
        },

        async _loadHTML(path) {
            if (this.cache.has(path)) return this.cache.get(path)

            const res = await fetch(path)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            const html = await res.text()
            this.cache.set(path, html)
            return html
        },

        _render(html) {
            this.contentEl.innerHTML = html
            window.scrollTo({ top: 0, behavior: 'instant' })
            this.contentEl.focus({ preventScroll: true })
        },

        _errorHTML(title, detail) {
            return `
            <main>
                <h2>${title}</h2>
                <p>${detail}</p>
            </main>`
        },

        // public api
        navigate(slug) { this._navigateTo(slug, true) },

        async initSidebar() {
            let config
            try {
                const res = await fetch(ROUTES_URL + (CACHE_VERSION ? '?v=' + CACHE_VERSION : ''))
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                config = await res.json()
            } catch (err) {
                console.error('[router] initSidebar: failed to load routes.json:', err)
                return
            }
            this._rootRoutes = config.routes
            this._flattenRoutes(config.routes)
            buildSidebar(config.routes)
        },
    }

    // sidebar
    function buildSidebar(routes) {
        const nav = document.getElementById('sidebar-nav')
        if (!nav) return
        nav.innerHTML = ''
        nav.appendChild(_buildList(routes, 0))

        const countEl = document.getElementById('routes-count')
        if (countEl) countEl.textContent = router.allRoutes.length
    }

    function _buildList(routes, depth) {
        const ul = document.createElement('ul')
        ul.className = 'nav-list' + (depth === 0 ? ' nav-root' : ' nav-children')
        for (const route of routes) ul.appendChild(_buildItem(route, depth))
        return ul
    }

    function _buildItem(route, depth) {
        const clickEvent = (e) => {
            e.preventDefault()
            if (route.pages?.length && router.currentSlug === route.slug) li.classList.toggle('open')
            else router.navigate(route.slug)
        }
        const li = document.createElement('li')
        li.className = 'nav-item'
        li.dataset.slug = route.slug

        const row = document.createElement('div')
        row.className = 'nav-row'

        const a = document.createElement('a')
        a.className = 'nav-link'
        a.href = route.slug
        a.dataset.slug = route.slug
        a.addEventListener('click', (e) => clickEvent(e))

        const linkText = document.createElement('span')
        linkText.className = 'nav-link-text'
        linkText.textContent = route.title
        a.appendChild(linkText)
        row.appendChild(a)

        if (route.pages?.length) {
            li.classList.add('has-children')

            const badge = document.createElement('span')
            badge.className = 'nav-badge'
            badge.textContent = route.pages.length
            badge.addEventListener('click', (e) => clickEvent(e))
            row.appendChild(badge)

            const chevron = document.createElement('button')
            chevron.className = 'nav-chevron'
            chevron.setAttribute('aria-label', `Toggle ${route.title}`)
            chevron.setAttribute('aria-hidden', 'true')
            chevron.setAttribute('tabindex', '-1')

            chevron.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                li.classList.toggle('open')
            })

            row.appendChild(chevron)

            li.appendChild(row)
            li.appendChild(_buildList(route.pages, depth + 1))
        } else li.appendChild(row)

        return li
    }

    // active state
    function syncActive(slug) {
        document.querySelectorAll('.nav-link.active').forEach(el => el.classList.remove('active'))

        const link = document.querySelector(`.nav-link[data-slug="${CSS.escape(slug)}"]`)
        if (!link) return

        link.classList.add('active')

        const ancestors = new Set()
        let ancestor = link.closest('.nav-item')?.parentElement?.closest('.nav-item')
        while (ancestor) {
            ancestors.add(ancestor)
            ancestor = ancestor.parentElement?.closest('.nav-item')
        }

        const selfItem = link.closest('.nav-item')
        if (selfItem?.classList.contains('has-children')) ancestors.add(selfItem)

        document.querySelectorAll('.nav-item.open').forEach(el => {
            if (!ancestors.has(el))
                el.classList.remove('open')
        })

        ancestors.forEach(el => el.classList.add('open'))
        link.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    // mobile sidebar
    function openMobileSidebar() {
        const sidebar = document.getElementById('sidebar')
        const overlay = document.getElementById('sidebar-overlay')
        const hamburger = document.getElementById('hamburger')

        sidebar?.classList.add('open')
        overlay?.classList.add('visible')
        hamburger?.classList.add('open')
        hamburger?.setAttribute('aria-expanded', 'true')
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar')
        const overlay = document.getElementById('sidebar-overlay')
        const hamburger = document.getElementById('hamburger')

        sidebar?.classList.remove('open')
        overlay?.classList.remove('visible')
        hamburger?.classList.remove('open')
        hamburger?.setAttribute('aria-expanded', 'false')
    }

    function initMobileSidebar() {
        const hamburger = document.getElementById('hamburger')
        const overlay = document.getElementById('sidebar-overlay')

        hamburger?.addEventListener('click', () => {
            const isOpen = document.getElementById('sidebar')?.classList.contains('open')
            isOpen ? closeMobileSidebar() : openMobileSidebar()
        })

        overlay?.addEventListener('click', closeMobileSidebar)
    }

    // search
    function initSearch() {
        const input = document.getElementById('nav-search')
        const clearBtn = document.getElementById('search-clear')
        const resultsEl = document.getElementById('nav-results')
        const navEl = document.getElementById('sidebar-nav')
        const countEl = document.getElementById('routes-count')
        if (!input || !resultsEl || !navEl) return

        let activeIdx = -1

        function highlightNode(text, query) {
            const frag = document.createDocumentFragment()
            const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            let last = 0, m
            while ((m = re.exec(text)) !== null) {
                if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)))
                const mark = document.createElement('mark')
                mark.textContent = m[0]
                frag.appendChild(mark)
                last = re.lastIndex
            }
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
            return frag
        }

        function getBreadcrumb(route) {
            function findParents(routes, target, chain) {
                for (const r of routes) {
                    if (r.slug === target.slug) return chain
                    if (r.pages?.length) {
                        const found = findParents(r.pages, target, [...chain, r.title])
                        if (found) return found
                    }
                }
                return null
            }
            const chain = findParents(router._rootRoutes || [], route, [])
            return chain ? chain.join(' > ') : ''
        }


        function renderResults(query) {
            const q = query.trim().toLowerCase()
            activeIdx = -1

            if (!q) {
                resultsEl.classList.remove('visible')
                navEl.style.display = ''
                if (countEl) countEl.textContent = router.allRoutes.length
                clearBtn?.classList.remove('visible')
                return
            }

            clearBtn?.classList.add('visible')
            navEl.style.display = 'none'
            resultsEl.classList.add('visible')
            resultsEl.innerHTML = ''

            const ql = q.toLowerCase()
            const fuse = new Fuse(router.allRoutes, {
                keys: ['title', 'slug'],
                threshold: 0.45,
                ignoreLocation: true,
                includeScore: true
            })

            const sorted = fuse.search(q)
                .map(r => ({ item: r.item, score: r.score ?? 1 }))
                .sort((a, b) => {
                    const aTitle = a.item.title.toLowerCase()
                    const bTitle = b.item.title.toLowerCase()

                    // match
                    const aExact = aTitle === ql
                    const bExact = bTitle === ql
                    if (aExact !== bExact) return aExact ? -1 : 1

                    // starts
                    const aStarts = aTitle.startsWith(ql)
                    const bStarts = bTitle.startsWith(ql)
                    if (aStarts !== bStarts) return aStarts ? -1 : 1

                    // boundary
                    const re = new RegExp(`\\b${ql}`)
                    const aWord = re.test(aTitle)
                    const bWord = re.test(bTitle)
                    if (aWord !== bWord) return aWord ? -1 : 1

                    // fuse score
                    return a.score - b.score
                })
                .map(r => r.item)

            if (countEl) countEl.textContent = sorted.length
            if (!sorted.length) {
                const empty = document.createElement('div')
                empty.className = 'search-empty'
                const strong = document.createElement('strong')
                strong.textContent = 'No results'
                const em = document.createElement('em')
                em.textContent = query
                empty.appendChild(strong)
                empty.appendChild(document.createTextNode(' Nothing matched '))
                empty.appendChild(em)
                resultsEl.appendChild(empty)
                return
            }

            sorted.forEach((route, i) => {
                const item = document.createElement('div')
                item.className = 'search-result-item'
                item.setAttribute('role', 'option')
                item.dataset.idx = i

                const titleEl = document.createElement('span')
                titleEl.className = 'result-title'
                titleEl.appendChild(highlightNode(route.title, query.trim()))

                const metaEl = document.createElement('span')
                metaEl.className = 'result-meta'

                const bread = getBreadcrumb(route)
                const breadcrumbEl = document.createElement('span')
                breadcrumbEl.className = 'result-breadcrumb'
                breadcrumbEl.textContent = bread.length > 0 ? bread : route.title

                const slugEl = document.createElement('span')
                slugEl.className = 'result-slug'
                slugEl.textContent = route.slug

                metaEl.appendChild(breadcrumbEl)
                metaEl.appendChild(slugEl)
                item.appendChild(titleEl)
                item.appendChild(metaEl)

                item.addEventListener('click', () => {
                    clearSearch()
                    closeMobileSidebar()
                    router.navigate(route.slug)
                })

                resultsEl.appendChild(item)
            })
        }

        function setActive(idx) {
            const items = resultsEl.querySelectorAll('.search-result-item')
            items.forEach(el => el.classList.remove('active-result'))
            activeIdx = Math.max(0, Math.min(idx, items.length - 1))
            if (activeIdx >= 0) {
                items[activeIdx].classList.add('active-result')
                items[activeIdx].scrollIntoView({ block: 'center' })
            }
        }

        function clearSearch() {
            input.value = ''
            renderResults('')
        }

        input.addEventListener('input', () => renderResults(input.value))
        input.addEventListener('keydown', (e) => {
            const items = resultsEl.querySelectorAll('.search-result-item')
            if (!items.length) return
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive(activeIdx + 1)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive(activeIdx - 1)
            } else if (e.key === 'Enter' && activeIdx >= 0) {
                e.preventDefault()
                items[activeIdx].click()
            } else if (e.key === 'Escape') {
                clearSearch()
                input.blur()
            }
        })

        clearBtn?.addEventListener('click', () => {
            clearSearch()
            input.focus()
        })
    }

    // collapse all
    function initCollapse() {
        const btn = document.getElementById('btn-collapse')
        if (!btn) return
        btn.addEventListener('click', (e) => {
            e.preventDefault()
            document.querySelectorAll('.nav-item.open').forEach(el => el.classList.remove('open'))
        })
    }

    // theme toggle
    function initThemeToggle() {
        const btn = document.getElementById('theme-toggle')
        if (!btn || !window.getEffectiveTheme || !window.setThemePreference) return

        function syncIcon() {
            const isDark = window.getEffectiveTheme() === 'dark'
            const icon = btn.querySelector('.theme-icon')
            if (icon) icon.textContent = isDark ? '☀' : '☾'
            btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode')
            btn.title = btn.getAttribute('aria-label')
        }

        btn.addEventListener('click', () => {
            const isDark = window.getEffectiveTheme() === 'dark'
            window.setThemePreference(isDark ? 'light' : 'dark')
            syncIcon()
        })

        window.addEventListener('theme-changed', syncIcon)
        syncIcon()
    }

    // boot
    document.addEventListener('DOMContentLoaded', () => {
        progress.init()
        initThemeToggle()
        initMobileSidebar()
        initSearch()
        initCollapse()
    })

    window.router = router
})()