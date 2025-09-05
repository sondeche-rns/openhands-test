// Fixed WISP Mapping App with Interactive Viewer
// Replace your existing web/app.js with this corrected version

const el = (sel) => document.querySelector(sel)
const fileInput = el('#file')
const statusChip = el('#status')
const infoPre = el('#info')
const svg = el('#preview')

const opt = {
  ssidCol: el('#opt-ssid-col'),
  modeCol: el('#opt-mode-col'),
  nameCol: el('#opt-name-col'),
  orient: el('#opt-orient'),
  group: el('#opt-group'),
}

// Interactive Viewer Class - Fixed Version
class InteractiveViewer {
  constructor(svgElement) {
    this.svg = svgElement
    this.viewBox = { x: 0, y: 0, width: 1600, height: 900 }
    this.scale = 1
    this.isPanning = false
    this.lastPanPoint = { x: 0, y: 0 }
    this.selectedElements = new Set()
    
    this.setupInteractions()
    this.createControls()
  }

  setupInteractions() {
    // Mouse wheel zoom
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault()
      const rect = this.svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
      this.zoomAt(mouseX, mouseY, scaleFactor)
    }, { passive: false })

    // Pan functionality
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !e.target.closest('.node-group')) {
        this.isPanning = true
        this.lastPanPoint = { x: e.clientX, y: e.clientY }
        this.svg.style.cursor = 'grabbing'
        e.preventDefault()
      }
    })

    document.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastPanPoint.x
        const dy = e.clientY - this.lastPanPoint.y
        
        this.viewBox.x -= dx / this.scale
        this.viewBox.y -= dy / this.scale
        this.updateViewBox()
        
        this.lastPanPoint = { x: e.clientX, y: e.clientY }
      }
    })

    document.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false
        this.svg.style.cursor = 'grab'
      }
    })

    // Node selection
    this.svg.addEventListener('click', (e) => {
      const nodeGroup = e.target.closest('.node-group')
      if (nodeGroup) {
        if (!e.ctrlKey && !e.metaKey) {
          this.clearSelection()
        }
        this.selectElement(nodeGroup)
      } else if (!e.ctrlKey && !e.metaKey) {
        this.clearSelection()
      }
    })

    // Double-click to fit
    this.svg.addEventListener('dblclick', (e) => {
      e.preventDefault()
      this.fitToContent()
    })
  }

  createControls() {
    const toolbar = document.querySelector('.toolbar')
    
    // Check if controls already exist
    if (document.querySelector('.viewer-controls')) return
    
    const controlsHtml = `
      <div class="viewer-controls">
        <button id="zoom-in" class="icon" title="Zoom In (Ctrl++)">
          <span class="material-symbols-outlined">zoom_in</span>
        </button>
        <button id="zoom-out" class="icon" title="Zoom Out (Ctrl+-)">
          <span class="material-symbols-outlined">zoom_out</span>
        </button>
        <button id="fit-screen" class="icon" title="Fit to Screen (F)">
          <span class="material-symbols-outlined">fit_screen</span>
        </button>
        <button id="zoom-reset" class="icon" title="Reset Zoom (1:1)">
          <span class="material-symbols-outlined">restart_alt</span>
        </button>
        <div class="zoom-info">
          <span id="zoom-level">100%</span>
        </div>
      </div>
    `
    
    toolbar.insertAdjacentHTML('beforeend', controlsHtml)
    
    // Control event listeners
    document.getElementById('zoom-in').addEventListener('click', () => this.zoom(1.2))
    document.getElementById('zoom-out').addEventListener('click', () => this.zoom(0.8))
    document.getElementById('fit-screen').addEventListener('click', () => this.fitToContent())
    document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom())

    // Keyboard shortcuts - only add once
    if (!document._keyboardListenerAdded) {
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
        
        switch(e.key) {
          case '+':
          case '=':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              this.zoom(1.2)
            }
            break
          case '-':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              this.zoom(0.8)
            }
            break
          case 'f':
          case 'F':
            e.preventDefault()
            this.fitToContent()
            break
          case 'Escape':
            this.clearSelection()
            break
          case 'a':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              this.selectAll()
            }
            break
        }
      })
      document._keyboardListenerAdded = true
    }
  }

  zoomAt(mouseX, mouseY, scaleFactor) {
    const rect = this.svg.getBoundingClientRect()
    const svgX = (mouseX / rect.width) * this.viewBox.width + this.viewBox.x
    const svgY = (mouseY / rect.height) * this.viewBox.height + this.viewBox.y
    
    const newScale = Math.max(0.1, Math.min(5, this.scale * scaleFactor))
    const scaleChange = newScale / this.scale
    
    this.viewBox.width = this.viewBox.width / scaleChange
    this.viewBox.height = this.viewBox.height / scaleChange
    this.viewBox.x = svgX - (svgX - this.viewBox.x) / scaleChange
    this.viewBox.y = svgY - (svgY - this.viewBox.y) / scaleChange
    
    this.scale = newScale
    this.updateViewBox()
    this.updateZoomInfo()
  }

  zoom(factor) {
    const centerX = this.viewBox.x + this.viewBox.width / 2
    const centerY = this.viewBox.y + this.viewBox.height / 2
    
    const newScale = Math.max(0.1, Math.min(5, this.scale * factor))
    const scaleChange = newScale / this.scale
    
    this.viewBox.width = this.viewBox.width / scaleChange
    this.viewBox.height = this.viewBox.height / scaleChange
    this.viewBox.x = centerX - this.viewBox.width / 2
    this.viewBox.y = centerY - this.viewBox.height / 2
    
    this.scale = newScale
    this.updateViewBox()
    this.updateZoomInfo()
  }

  fitToContent() {
    const bbox = this.getContentBounds()
    if (!bbox) return
    
    const padding = 40
    this.viewBox = {
      x: bbox.x - padding,
      y: bbox.y - padding,
      width: bbox.width + padding * 2,
      height: bbox.height + padding * 2
    }
    
    const rect = this.svg.getBoundingClientRect()
    this.scale = Math.min(
      rect.width / this.viewBox.width,
      rect.height / this.viewBox.height
    )
    
    this.updateViewBox()
    this.updateZoomInfo()
  }

  resetZoom() {
    this.viewBox = { x: 0, y: 0, width: 1600, height: 900 }
    this.scale = 1
    this.updateViewBox()
    this.updateZoomInfo()
  }

  getContentBounds() {
    const elements = this.svg.querySelectorAll('.node-group')
    if (elements.length === 0) return null
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    elements.forEach(el => {
      try {
        const bbox = el.getBBox()
        minX = Math.min(minX, bbox.x)
        minY = Math.min(minY, bbox.y)
        maxX = Math.max(maxX, bbox.x + bbox.width)
        maxY = Math.max(maxY, bbox.y + bbox.height)
      } catch (e) {
        // Ignore elements that can't be measured
      }
    })
    
    if (minX === Infinity) return null
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  selectElement(element) {
    element.classList.add('selected')
    this.selectedElements.add(element)
  }

  clearSelection() {
    this.selectedElements.forEach(el => el.classList.remove('selected'))
    this.selectedElements.clear()
  }

  selectAll() {
    const elements = this.svg.querySelectorAll('.node-group')
    elements.forEach(el => this.selectElement(el))
  }

  updateViewBox() {
    this.svg.setAttribute('viewBox', 
      `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`
    )
  }

  updateZoomInfo() {
    const zoomLevel = document.getElementById('zoom-level')
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.scale * 100)}%`
    }
  }
}

// Helper functions for SVG creation
function textNode(x, y, lines, cls = '') {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('class', 'text-node')
  
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  t.setAttribute('x', x + 10)
  t.setAttribute('y', y + 18)
  t.setAttribute('class', cls)
  
  lines.slice(0, 6).forEach((ln, i) => {
    const tsp = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
    tsp.setAttribute('x', x + 10)
    tsp.setAttribute('dy', i === 0 ? 0 : 14)
    tsp.textContent = ln
    t.appendChild(tsp)
  })
  
  g.appendChild(t)
  return g
}

function rectNode(x, y, w, h, cls = '') {
  const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  r.setAttribute('x', x)
  r.setAttribute('y', y)
  r.setAttribute('width', w)
  r.setAttribute('height', h)
  r.setAttribute('rx', 10)
  r.setAttribute('class', 'node ' + cls)
  return r
}

function link(x1, y1, x2, y2, cls = '') {
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  l.setAttribute('x1', x1)
  l.setAttribute('y1', y1)
  l.setAttribute('x2', x2)
  l.setAttribute('y2', y2)
  l.setAttribute('class', 'edge ' + cls)
  l.setAttribute('marker-end', 'url(#arrowhead)')
  return l
}

// CSV parsing (no external deps)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(row => {
    const cols = []
    let cur = '', inQ = false
    for (let i = 0; i < row.length; i++) {
      const c = row[i]
      if (c === '"') inQ = !inQ
      else if (c === ',' && !inQ) { cols.push(cur); cur = '' }
      else cur += c
    }
    cols.push(cur)
    const obj = {}
    header.forEach((h, i) => obj[h] = (cols[i] || '').replace(/^"|"$/g, ''))
    return obj
  })
}

// HTML parsing
function parseHTML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return []
  const heads = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map(th => th.textContent.trim())
  const rows = []
  table.querySelectorAll('tr').forEach((tr, idx) => {
    if (idx === 0 && heads.length) return
    const cells = Array.from(tr.querySelectorAll('td'))
    if (!cells.length) return
    const obj = {}
    cells.forEach((td, i) => obj[heads[i] || `col${i}`] = td.textContent.trim())
    rows.push(obj)
  })
  return rows
}

// XML parsing
function parseXML(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parserErr = doc.querySelector('parsererror')
  if (parserErr) { console.warn('XML parse error'); return [] }
  let candidates = []
  const counts = new Map()
    ; (function walk(node) {
      node.childNodes.forEach(n => {
        if (n.nodeType === 1) {
          const name = n.nodeName
          counts.set(name, (counts.get(name) || 0) + 1)
          walk(n)
        }
      })
    })(doc.documentElement)
  let best = null, bestC = 0
  counts.forEach((c, k) => { if (c > bestC) { bestC = c; best = k } })
  candidates = Array.from(doc.getElementsByTagName(best || doc.documentElement.nodeName))
  return candidates.map(el => {
    const obj = {}
    Array.from(el.attributes || []).forEach(a => obj[a.name] = a.value)
    Array.from(el.children || []).forEach(c => obj[c.tagName] = c.textContent.trim())
    if (Object.keys(obj).length === 0) obj.value = el.textContent.trim()
    return obj
  })
}

function detectType(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return 'csv'
  if (name.endsWith('.xml')) return 'xml'
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'html'
  return 'csv'
}

function groupBy(data, key) {
  const g = new Map()
  for (const row of data) {
    const k = (row[key] || 'Unknown').trim()
    const arr = g.get(k) || []
    arr.push(row)
    g.set(k, arr)
  }
  return g
}

function computeLayout(records) {
  const modeKey = opt.modeCol.value || 'Mode'
  const nameKey = opt.nameCol.value || 'Device Name'
  const ssidKey = opt.ssidCol.value || 'SSID'
  const orient = opt.orient.value || 'LR'
  const bySSID = groupBy(records, ssidKey)

  const groups = []
  const nodes = []
  const edges = []
  let gx = 40, gy = 40
  const gw = 440, gh = 220

  for (const [ssid, rows] of bySSID) {
    const groupId = `g_${ssid.replace(/[^a-zA-Z0-9]/g, '_')}`
    const ap = rows.filter(r => (r[modeKey] || '').toUpperCase() === 'AP')
    const sta = rows.filter(r => (r[modeKey] || '').toUpperCase() !== 'AP')

    const gNode = { id: groupId, type: 'group', label: ssid || 'Unknown', x: gx, y: gy, w: gw, h: gh }
    groups.push(gNode)

    const apStartX = gx + 20, apStartY = gy + 30
    const staStartX = gx + 20, staStartY = gy + 110
    const colW = 200, rowH = 60

    ap.forEach((r, i) => {
      const x = apStartX + (i % 2) * colW
      const y = apStartY + Math.floor(i / 2) * rowH
      const id = `n_${groupId}_${i}_ap`
      nodes.push({ id, kind: 'AP', label: r[nameKey] || 'AP', ip: r['IP Address'] || '', x, y, w: 180, h: 40 })
    })
    sta.forEach((r, i) => {
      const x = staStartX + (i % 2) * colW
      const y = staStartY + Math.floor(i / 2) * rowH
      const id = `n_${groupId}_${i}_sta`
      nodes.push({ id, kind: 'STA', label: r[nameKey] || 'STA', ip: r['IP Address'] || '', x, y, w: 180, h: 40 })
    })

    if (ap.length) {
      const apX = apStartX + 90, apY = apStartY + 20
      sta.forEach((r, i) => {
        const sx = staStartX + (i % 2) * colW + 90
        const sy = staStartY + Math.floor(i / 2) * rowH + 20
        edges.push({ from: { x: apX, y: apY }, to: { x: sx, y: sy }, cls: 'ap-link' })
      })
    }

    if (orient === 'LR') gx += gw + 40; else gy += gh + 40
  }
  return { groups, nodes, edges }
}

// Enhanced renderSVG function
function renderSVG(layout) {
  svg.innerHTML = ''
  
  // Create arrow marker first
  createArrowMarker()
  
  const pad = 40
  let maxX = 0, maxY = 0

  // Create organized layers
  const groupsContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  groupsContainer.setAttribute('class', 'groups-layer')
  svg.appendChild(groupsContainer)

  const edgesContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  edgesContainer.setAttribute('class', 'edges-layer')
  svg.appendChild(edgesContainer)

  const nodesContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  nodesContainer.setAttribute('class', 'nodes-layer')
  svg.appendChild(nodesContainer)

  // Render groups
  for (const g of layout.groups) {
    const groupEl = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    groupEl.setAttribute('class', 'node-group ssid-group')
    groupEl.setAttribute('data-id', g.id)
    
    const r = rectNode(g.x, g.y, g.w, g.h, 'ssid')
    const t = textNode(g.x + 8, g.y + 6, [g.label], 'group-label')
    
    groupEl.appendChild(r)
    groupEl.appendChild(t)
    groupsContainer.appendChild(groupEl)
    
    maxX = Math.max(maxX, g.x + g.w)
    maxY = Math.max(maxY, g.y + g.h)
  }

  // Render edges
  for (const e of layout.edges) {
    const edge = link(e.from.x, e.from.y, e.to.x, e.to.y, e.cls || '')
    edgesContainer.appendChild(edge)
  }

  // Render nodes
  for (const n of layout.nodes) {
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    nodeGroup.setAttribute('class', 'node-group device-node')
    nodeGroup.setAttribute('data-id', n.id)
    nodeGroup.setAttribute('data-kind', n.kind)
    
    const cls = n.kind === 'AP' ? 'ap' : 'sta'
    const rect = rectNode(n.x, n.y, n.w, n.h, cls)
    const label = n.ip ? `${n.label}\n${n.ip}` : n.label
    const text = textNode(n.x + 6, n.y + 8, label.split(/\n/))
    
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = `${n.kind}: ${n.label}${n.ip ? ' (' + n.ip + ')' : ''}`
    
    nodeGroup.appendChild(rect)
    nodeGroup.appendChild(text)
    nodeGroup.appendChild(title)
    nodesContainer.appendChild(nodeGroup)
    
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }

  const totalWidth = Math.max(1600, maxX + pad)
  const totalHeight = Math.max(900, maxY + pad)
  svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`)

  // Initialize interactive viewer
  if (svg._interactiveViewer) {
    // Update existing viewer
    svg._interactiveViewer.updateViewBox()
  } else {
    // Create new viewer
    svg._interactiveViewer = new InteractiveViewer(svg)
  }
}

function createArrowMarker() {
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }
  
  if (svg.querySelector('#arrowhead')) return
  
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')
  marker.setAttribute('id', 'arrowhead')
  marker.setAttribute('markerWidth', '10')
  marker.setAttribute('markerHeight', '7')
  marker.setAttribute('refX', '9')
  marker.setAttribute('refY', '3.5')
  marker.setAttribute('orient', 'auto')
  
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  polygon.setAttribute('points', '0 0, 10 3.5, 0 7')
  polygon.setAttribute('fill', '#3e4d63')
  
  marker.appendChild(polygon)
  defs.appendChild(marker)
}

// Export functionality
function exportDrawio(layout) {
  let id = 1
  const cells = []
  const rootId = id++
  cells.push(`<mxCell id="${rootId}"/>`)
  const layerId = id++
  cells.push(`<mxCell id="${layerId}" parent="${rootId}"/>`)

  function addVertex(x, y, w, h, label, style) {
    const cellId = id++
    const s = style || 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#334155;fontColor=#e2e8f0;'
    const mx = `<mxCell id="${cellId}" value="${escapeXml(label)}" style="${s}" vertex="1" parent="${layerId}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`
    cells.push(mx)
    return cellId
  }
  
  function addEdge(srcId, trgId, style) {
    const cellId = id++
    const s = style || 'endArrow=block;rounded=1;strokeColor=#64748b;'
    const mx = `<mxCell id="${cellId}" edge="1" parent="${layerId}" source="${srcId}" target="${trgId}"><mxGeometry relative="1" as="geometry"/></mxCell>`
    cells.push(mx)
    return cellId
  }

  const nodeCells = []
  for (const g of layout.groups) {
    addVertex(g.x, g.y, g.w, g.h, g.label, 'shape=swimlane;rounded=1;fillColor=#0f172a;strokeColor=#334155;fontColor=#94a3b8;horizontal=0;')
  }
  for (const n of layout.nodes) {
    const style = n.kind === 'AP'
      ? 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#134e4a;strokeColor=#2dd4bf;fontColor=#e2e8f0;'
      : 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#334155;fontColor=#e2e8f0;'
    const label = n.ip ? `${n.label}\\n${n.ip}` : n.label
    const cid = addVertex(n.x, n.y, n.w, n.h, label, style)
    nodeCells.push({ id: cid, center: { x: n.x + n.w / 2, y: n.y + n.h / 2 } })
  }
  for (const e of layout.edges) {
    let src = -1, trg = -1, ds = 1e9, dt = 1e9
    for (const nn of nodeCells) {
      const d1 = Math.hypot(nn.center.x - e.from.x, nn.center.y - e.from.y)
      const d2 = Math.hypot(nn.center.x - e.to.x, nn.center.y - e.to.y)
      if (d1 < ds) { ds = d1; src = nn.id }
      if (d2 < dt) { dt = d2; trg = nn.id }
    }
    if (src > 0 && trg > 0) addEdge(src, trg)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net"><diagram name="Mapping"><mxGraphModel><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
  download('mapping.drawio', xml, 'application/xml')
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function download(filename, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

let currentRecords = []

async function handleFile(file) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const text = reader.result
      let rows = []
      const type = detectType(file)
      if (type === 'csv') rows = parseCSV(text)
      else if (type === 'xml') rows = parseXML(text)
      else rows = parseHTML(text)
      currentRecords = rows
      infoPre.textContent = JSON.stringify(rows.slice(0, 20), null, 2)
      statusChip.textContent = `${file.name} · ${rows.length} records`
      const layout = computeLayout(rows)
      renderSVG(layout)
    } catch (error) {
      console.error('Error processing file:', error)
      statusChip.textContent = 'Error processing file'
    }
  }
  reader.readAsText(file)
}

// Event listeners
fileInput.addEventListener('change', (e) => {
  const f = e.target.files?.[0]
  if (f) handleFile(f)
})

// Drag-n-drop
const upload = document.querySelector('.upload')
upload.addEventListener('dragover', (e) => { e.preventDefault(); upload.classList.add('hover') })
upload.addEventListener('dragleave', () => upload.classList.remove('hover'))
upload.addEventListener('drop', (e) => {
  e.preventDefault(); upload.classList.remove('hover')
  const f = e.dataTransfer.files?.[0]
  if (f) handleFile(f)
})

// Buttons
el('#btn-clear').addEventListener('click', () => {
  currentRecords = []
  svg.innerHTML = ''
  infoPre.textContent = ''
  statusChip.textContent = 'No file loaded'
  fileInput.value = ''
  // Clear controls
  const controls = document.querySelector('.viewer-controls')
  if (controls) controls.remove()
})

el('#btn-export').addEventListener('click', () => {
  if (!currentRecords.length) { alert('Load data first.'); return }
  const layout = computeLayout(currentRecords)
  exportDrawio(layout)
})

el('#btn-load-sample').addEventListener('click', async () => {
  try {
    const res = await fetch('/mwakazi_net_bst1.csv')
    const txt = await res.text()
    const rows = parseCSV(txt)
    currentRecords = rows
    infoPre.textContent = JSON.stringify(rows.slice(0, 20), null, 2)
    statusChip.textContent = `Sample CSV · ${rows.length} records`
    const layout = computeLayout(rows)
    renderSVG(layout)
  } catch (error) {
    console.error('Error loading sample:', error)
    statusChip.textContent = 'Error loading sample'
  }
})

// Options change handlers
Object.values(opt).forEach(input => {
  if (input) {
    input.addEventListener('change', () => {
      if (currentRecords.length) {
        const layout = computeLayout(currentRecords)
        renderSVG(layout)
      }
    })
  }
})