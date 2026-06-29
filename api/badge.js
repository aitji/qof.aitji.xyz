const PALETTE = {
  bg: '#161b22',
  labelBg: '#0e1217',
  border: '#30363d',
  gold: '#ffd84d',
  outline: '#21262d',
  labelText: '#e6edf3',
  errorGold: '#e5325f',
}

const esc = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textWidth = (str, charW) => Math.round(str.length * charW)
function buildBadgeSvg({ label, value, isError = false, rounded = true }) {
  const labelFontSize = 11
  const valueFontSize = 14
  const labelCharW = 6.5
  const valueCharW = 8.1

  const labelPadX = 20
  const valuePadX = 15
  const height = 32
  const radius = rounded ? 4 : 0

  const labelStr = label.toUpperCase()
  const labelW = textWidth(labelStr, labelCharW) + labelPadX * 2
  const valueW = textWidth(value, valueCharW) + valuePadX * 2
  const totalW = labelW + valueW

  const gold = isError ? PALETTE.errorGold : PALETTE.gold
  const labelX = labelW / 2
  const valueX = labelW + valueW / 2
  const midY = height / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" viewBox="0 0 ${totalW} ${height}" role="img" aria-label="${esc(labelStr)}: ${esc(value)}">
  <defs>
    <clipPath id="clip"><rect width="${totalW}" height="${height}" rx="${radius}"/></clipPath>
    <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="0.14" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.86" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="0" height="${height}" fill="${PALETTE.bg}"/>
    <rect x="0" width="${labelW}" height="${height}" fill="${PALETTE.labelBg}"/>
    <rect x="${labelW}" width="${valueW}" height="${height}" fill="${PALETTE.bg}"/>
    <rect x="-0.5" width="1" height="${height}" fill="#000000" opacity="0.35"/>
    <rect x="${labelW - 0.5}" width="1" height="${height}" fill="#000000" opacity="0.35"/>

    <text x="${labelX}" y="${midY + 4}" font-family="Verdana, 'Segoe UI', sans-serif" font-size="${labelFontSize}" font-weight="700" letter-spacing="0.6" fill="${PALETTE.labelText}" text-anchor="middle">${esc(labelStr)}</text>

    <text x="${valueX}" y="${(midY + 4.6).toFixed(1)}" font-family="Verdana, 'Segoe UI', sans-serif" font-size="${valueFontSize}" font-weight="700" letter-spacing="0.2" fill="${gold}" stroke="${PALETTE.outline}" stroke-width="1.8" stroke-linejoin="round" paint-order="stroke" text-anchor="middle">${esc(value)}</text>
    <rect width="${totalW}" height="${height}" rx="${radius}" fill="url(#bevel)"/>
  </g>
  <rect x="0.5" y="0.5" width="${totalW - 1}" height="${height - 1}" rx="${radius}" fill="none" stroke="${PALETTE.border}"/>
</svg>`
}

function formatVersion(json) {
  try {
    const files = json.latestFiles || []
    const main = files.find((f) => f.id === json.mainFileId) || files[files.length - 1]
    const match = main.fileName.match(/QoF[-_]v?(\d+(?:\.\d+)*)/i)
    return match ? `v${match[1]}` : main.displayName || 'unknown'
  } catch { return 'unknown' }
}

export default async function handler(req, res) {
  const type = (req.query && req.query.type) || 'downloads'
  const rounded = !(req.query && (req.query.square === '1' || req.query.square === 'true'))

  let label = 'downloads'
  let value = ''
  let isError = false

  try {
    const r = await fetch('https://raw.githubusercontent.com/aitji/QoF/stats/data/curseforge.json', { cache: 'no-store' })
    if (!r.ok) throw new Error(`upstream status ${r.status}`)
    const json = await r.json()

    if (type === 'version') {
      label = 'version'
      value = formatVersion(json)
    } else {
      label = 'downloads'
      value = Number(json.downloadCount || 0).toLocaleString('en-US')
    }
  } catch (err) {
    isError = true
    label = type === 'version' ? 'version' : 'downloads'
    value = 'error'
  }

  const svg = buildBadgeSvg({ label, value, isError, rounded })
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.setHeader(
  'Cache-Control',
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).send(svg)
}