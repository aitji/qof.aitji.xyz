document.addEventListener('DOMContentLoaded', function () {
    const lightbox = document.getElementById('lightbox')
    const lightboxImg = document.getElementById('lightbox-img')
    const closeBtn = document.getElementById('close-btn')
    const saveBtn = document.getElementById('save-btn')
    const zoomInBtn = document.getElementById('zoom-in-btn')
    const zoomOutBtn = document.getElementById('zoom-out-btn')
    const resetBtn = document.getElementById('reset-btn')
    const loader = document.querySelector('.loader')
    const cLightbox = document.querySelector('.lightbox-content')

    let isDragging = false
    let startX, startY
    let translateX = 0, translateY = 0
    let scale = 1
    let imgWidth = 0, imgHeight = 0
    let cWidth = 0, cHeight = 0

    document.addEventListener('click', e => {
        const img = e.target.closest('img')
        if (!img) return

        lightboxImg.src = img.src
        loader.style.display = 'block'
        lightbox.style.display = 'flex'
        document.body.style.overflow = 'hidden'

        const copyClass = ['pixel', 'img--no-border']
        for (const cls of copyClass) {
            if (img.classList.contains(cls) || (
                img.parentElement &&
                img.parentElement.classList.contains(cls)
            )) lightboxImg.classList.add(cls)
            else lightboxImg.classList.remove(cls)
        }

        cUpdateDim()

        lightboxImg.onload = () => {
            loader.style.display = 'none'
            imgWidth = lightboxImg.naturalWidth
            imgHeight = lightboxImg.naturalHeight
        }
    })

    function cUpdateDim() {
        const rect = cLightbox.getBoundingClientRect()
        cWidth = rect.width
        cHeight = rect.height
    }

    window.addEventListener('resize', cUpdateDim)
    closeBtn.addEventListener('click', closeLightbox)
    lightbox.addEventListener('click', (e) => e.target === lightbox && closeLightbox())

    function closeLightbox() {
        lightbox.style.display = 'none'
        document.body.style.overflow = 'auto'
        resetImg()
    }

    saveBtn.addEventListener('click', function () {
        const link = document.createElement('a')
        const url = lightboxImg.src
        const fileName = url.substring(url.lastIndexOf('/') + 1)
        link.href = url
        link.download = `QoF-${fileName}`
        link.click()
    })

    zoomInBtn.addEventListener('click', function () {
        scale += 0.25
        if (scale > 4) scale = 4
        updateForm()
    })

    zoomOutBtn.addEventListener('click', function () {
        scale -= 0.25
        if (scale < 0.5) scale = 0.5
        updateForm()
    })

    resetBtn.addEventListener('click', resetImg)

    function resetImg() {
        scale = 1
        translateX = 0
        translateY = 0
        updateForm()
    }

    function updateForm() {
        if (scale !== 1) {
            const maxX = Math.max((imgWidth * scale - cWidth) / 2, 0)
            const maxY = Math.max((imgHeight * scale - cHeight) / 2, 0)

            translateX = Math.min(Math.max(translateX, -maxX), maxX)
            translateY = Math.min(Math.max(translateY, -maxY), maxY)
        }
        updateFormDrag()
    }

    lightboxImg.addEventListener('mousedown', function (e) {
        e.preventDefault()
        isDragging = true
        startX = e.clientX - translateX
        startY = e.clientY - translateY
        lightboxImg.style.cursor = 'grabbing'
    })

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return
        e.preventDefault()

        translateX = e.clientX - startX
        translateY = e.clientY - startY

        updateFormDrag()
    })

    function updateFormDrag(overflow = 0.5) { /* 0.2 = 20% */
        cUpdateDim()
        imgWidth = lightboxImg.naturalWidth
        imgHeight = lightboxImg.naturalHeight

        const halfW = (imgWidth * scale) / 2
        const halfH = (imgHeight * scale) / 2
        const viewHalfW = cWidth / 2
        const viewHalfH = cHeight / 2

        const maxX = Math.max(halfW - viewHalfW, 0)
        const maxY = Math.max(halfH - viewHalfH, 0)

        translateX = Math.min(Math.max(translateX, -maxX * overflow), maxX * overflow)
        translateY = Math.min(Math.max(translateY, -maxY * overflow), maxY * overflow)

        lightboxImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
    }


    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false
            lightboxImg.style.cursor = 'move'
        }
    })

    let initDistance = 0
    let initScale = 1
    let lastX = 0
    let lastY = 0

    lightboxImg.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            isDragging = true
            startX = e.touches[0].clientX - translateX
            startY = e.touches[0].clientY - translateY
            lastX = e.touches[0].clientX
            lastY = e.touches[0].clientY
        } else if (e.touches.length === 2) {
            isDragging = false
            initDistance = getDistance(
                e.touches[0].clientX,
                e.touches[0].clientY,
                e.touches[1].clientX,
                e.touches[1].clientY
            )
            initScale = scale
        }
    }, { passive: true })

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length === 1 && isDragging) {
            const currentX = e.touches[0].clientX
            const currentY = e.touches[0].clientY

            if (Math.abs(currentX - lastX) > 1 || Math.abs(currentY - lastY) > 1) {
                translateX = currentX - startX
                translateY = currentY - startY
                updateFormDrag()
                lastX = currentX
                lastY = currentY
            }
        } else if (e.touches.length === 2) {
            e.preventDefault()
            const currentDistance = getDistance(
                e.touches[0].clientX,
                e.touches[0].clientY,
                e.touches[1].clientX,
                e.touches[1].clientY
            )
            const ratio = currentDistance / initDistance
            scale = Math.min(Math.max(initScale * ratio, 0.5), 4)
            cUpdateDim()
            imgWidth = lightboxImg.naturalWidth
            imgHeight = lightboxImg.naturalHeight
            updateForm()

        }
    }, { passive: false })

    document.addEventListener('touchend', function () {
        if (isDragging) {
            isDragging = false
            updateForm()
        }
    }, { passive: true })

    lightboxImg.addEventListener('dblclick', resetImg)
    document.addEventListener('keydown', function (e) {
        if (lightbox.style.display === 'flex') {
            if (e.ctrlKey && e.key.includes(['+', '=', '-', '0', 's'])) e.preventDefault()
            if (e.key === 'Escape') closeLightbox()
            else if (e.key === '+' || e.key === '=') zoomInBtn.click()
            else if (e.key === '-') zoomOutBtn.click()
            else if (e.key === '0') resetBtn.click()
            else if (e.key === 's' && e.ctrlKey) {
                e.preventDefault()
                saveBtn.click()
            }
        }
    })

    const getDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    lightboxImg.addEventListener('wheel', function (e) {
        e.preventDefault()
        if (e.deltaY < 0) scale += 0.1
        else scale -= 0.1
        scale = Math.min(Math.max(scale, 0.5), 4)
        updateForm()
    }, { passive: false })
})
