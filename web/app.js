// Minimal Material-inspired UI without external libs
// Supports: CSV, XML, HTML inputs and exports to a .drawio file

const el = (sel) => document.querySelector(sel)
const fileInput = el('#file')
const statusChip = el('#status')
const infoPre = el('#info')
const svg = el('#preview')

// Zoom & Pan state using SVG viewBox
let baseViewBox = {x:0,y:0,w:1600,h:900}
let viewBox = {...baseViewBox}
function applyViewBox(){
  svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`)
}
function resetZoom(){ viewBox = {...baseViewBox}; applyViewBox() }
function zoomAt(clientX, clientY, factor){
  const rect = svg.getBoundingClientRect()
  const px = clientX - rect.left
  const py = clientY - rect.top
  const sx = viewBox.w / rect.width
  const sy = viewBox.h / rect.height
  const vx = viewBox.x + px * sx
  const vy = viewBox.y + py * sy
  viewBox.w *= factor
  viewBox.h *= factor
  viewBox.x = vx - px * (viewBox.w / rect.width)
  viewBox.y = vy - py * (viewBox.h / rect.height)
  applyViewBox()
}
function zoomBy(factor){
  const rect = svg.getBoundingClientRect()
  zoomAt(rect.left + rect.width/2, rect.top + rect.height/2, factor)
}
function buildNodeLines(n){
  const m = n.meta || {}
  const lines = []
  if(m['Device Name'] || n.label) lines.push(`Device Name: ${m['Device Name'] || n.label}`)
  if(m['MAC Address']) lines.push(`MAC Address: ${m['MAC Address']}`)
  if(m['Mode'] || n.kind) lines.push(`Mode: ${m['Mode'] || n.kind}`)
  if(m['SSID']) lines.push(`SSID: ${m['SSID']}`)
  if(m['Product']) lines.push(`Product: ${m['Product']}`)
  if(m['Firmware']) lines.push(`Firmware: ${m['Firmware']}`)
  if(m['IP Address'] || n.ip) lines.push(`IP Address: ${m['IP Address'] || n.ip}`)
  return lines
}

let isPanning=false, panStartX=0, panStartY=0, vbStartX=0, vbStartY=0
svg.addEventListener('mousedown', (e)=>{
  if(e.button!==0) return
  isPanning=true
  panStartX=e.clientX; panStartY=e.clientY
  vbStartX=viewBox.x; vbStartY=viewBox.y
})
window.addEventListener('mousemove', (e)=>{
  if(!isPanning) return
  const rect = svg.getBoundingClientRect()
  const dx = e.clientX - panStartX
  const dy = e.clientY - panStartY
  const sx = viewBox.w / rect.width
  const sy = viewBox.h / rect.height
  viewBox.x = vbStartX - dx * sx
  viewBox.y = vbStartY - dy * sy
  applyViewBox()
})
window.addEventListener('mouseup', ()=>{ isPanning=false })
svg.addEventListener('wheel', (e)=>{
  e.preventDefault()
  const factor = e.deltaY>0 ? 1.1 : 0.9
  zoomAt(e.clientX, e.clientY, factor)
}, {passive:false})
el('#zoom-in')?.addEventListener('click', ()=> zoomBy(0.9))
el('#zoom-out')?.addEventListener('click', ()=> zoomBy(1.1))
el('#zoom-reset')?.addEventListener('click', ()=> resetZoom())


const opt = {
  ssidCol: el('#opt-ssid-col'),
  modeCol: el('#opt-mode-col'),
  nameCol: el('#opt-name-col'),
  orient: el('#opt-orient'),
  group: el('#opt-group'),
}

// Helpers
function textNode(x, y, lines, cls=''){
  const g = document.createElementNS('http://www.w3.org/2000/svg','g')
  const t = document.createElementNS('http://www.w3.org/2000/svg','text')
  t.setAttribute('x', x+10)
  t.setAttribute('y', y+18)
  t.setAttribute('class', cls)
  lines.forEach((ln,i)=>{
    const tsp = document.createElementNS('http://www.w3.org/2000/svg','tspan')
    tsp.setAttribute('x', x+10)
    tsp.setAttribute('dy', i===0?0:14)
    tsp.textContent = ln
    t.appendChild(tsp)
  })
  g.appendChild(t)
  return g
}

function rectNode(x, y, w, h, cls=''){
  const r = document.createElementNS('http://www.w3.org/2000/svg','rect')
  r.setAttribute('x', x)
  r.setAttribute('y', y)
  r.setAttribute('width', w)
  r.setAttribute('height', h)
  r.setAttribute('rx', 10)
  r.setAttribute('class', 'node '+cls)
  return r
}

function link(x1,y1,x2,y2,cls=''){
  const l = document.createElementNS('http://www.w3.org/2000/svg','line')
  l.setAttribute('x1', x1)
  l.setAttribute('y1', y1)
  l.setAttribute('x2', x2)
  l.setAttribute('y2', y2)
  l.setAttribute('class', 'edge '+cls)
  return l
}

// CSV parsing (no external deps)
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean)
  if(!lines.length) return []
  const header = lines[0].split(',').map(h=>h.trim())
  return lines.slice(1).map(row=>{
    const cols = []
    let cur = '', inQ = false
    for(let i=0;i<row.length;i++){
      const c = row[i]
      if(c==='"') inQ = !inQ
      else if(c===',' && !inQ){ cols.push(cur); cur='' }
      else cur += c
    }
    cols.push(cur)
    const obj = {}
    header.forEach((h,i)=> obj[h]= (cols[i]||'').replace(/^"|"$/g,'') )
    return obj
  })
}

// HTML parsing: attempt to find first table and map header->cells
function parseHTML(text){
  const doc = new DOMParser().parseFromString(text, 'text/html')
  const table = doc.querySelector('table')
  if(!table) return []
  const heads = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map(th=>th.textContent.trim())
  const rows = []
  table.querySelectorAll('tr').forEach((tr, idx)=>{
    if(idx===0 && heads.length) return
    const cells = Array.from(tr.querySelectorAll('td'))
    if(!cells.length) return
    const obj = {}
    cells.forEach((td,i)=> obj[heads[i]||`col${i}`] = td.textContent.trim())
    rows.push(obj)
  })
  return rows
}

// XML parsing: convert element children into records with attributes/text
function parseXML(text){
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parserErr = doc.querySelector('parsererror')
  if(parserErr){ console.warn('XML parse error'); return [] }
  // Heuristic: pick the deepest repeated element
  let candidates = []
  const counts = new Map()
  ;(function walk(node){
    node.childNodes.forEach(n=>{
      if(n.nodeType===1){
        const name = n.nodeName
        counts.set(name, (counts.get(name)||0)+1)
        walk(n)
      }
    })
  })(doc.documentElement)
  let best = null, bestC=0
  counts.forEach((c,k)=>{ if(c>bestC){ bestC=c; best=k } })
  candidates = Array.from(doc.getElementsByTagName(best||doc.documentElement.nodeName))
  // map children/attributes
  return candidates.map(el=>{
    const obj = {}
    Array.from(el.attributes||[]).forEach(a=> obj[a.name]=a.value )
    Array.from(el.children||[]).forEach(c=> obj[c.tagName]=c.textContent.trim())
    if(Object.keys(obj).length===0) obj.value = el.textContent.trim()
    return obj
  })
}

function detectType(file){
  const name = file.name.toLowerCase()
  if(name.endsWith('.csv')) return 'csv'
  if(name.endsWith('.xml')) return 'xml'
  if(name.endsWith('.html')||name.endsWith('.htm')) return 'html'
  return 'csv'
}

function groupBy(data, key){
  const g = new Map()
  for(const row of data){
    const k = (row[key]||'Unknown').trim()
    const arr = g.get(k) || []
    arr.push(row)
    g.set(k, arr)
  }
  return g
}

function computeLayout(records){
  // Center AP(s) and distribute STAs radially in each SSID group
  const modeKey = opt.modeCol.value || 'Mode'
  const nameKey = opt.nameCol.value || 'Device Name'
  const ssidKey = opt.ssidCol.value || 'SSID'
  const orient = opt.orient.value // LR or TB
  const bySSID = groupBy(records, ssidKey)

  const groups = []
  const nodes = []
  const edges = []
  let gx = 40, gy = 40
  const gw = 440
  const padding = 20

  for(const [ssid, rows] of bySSID){
    const groupId = `g_${ssid}`
    const apRows = rows.filter(r => (r[modeKey]||'').toUpperCase()==='AP')
    const staRows = rows.filter(r => (r[modeKey]||'').toUpperCase()!=='AP')

    const gNode = { id: groupId, type:'group', label: ssid||'Unknown', x: gx, y: gy, w: gw, h: 220 }
    groups.push(gNode)

    const cx = gx + gw/2

    // Build nodes and compute dynamic heights
    const apNodes = apRows.map((r,i)=>{
      const n = {id:`n_${ssid}_${i}_ap`, kind:'AP', label: r[nameKey]||'AP', ip: r['IP Address']||'', x:0, y:0, w:180, h:40, meta:r}
      const l = buildNodeLines(n).length
      n.h = Math.max(40, 20 + l*14)
      return n
    })
    const staNodes = staRows.map((r,i)=>{
      const n = {id:`n_${ssid}_${i}_sta`, kind:'STA', label: r[nameKey]||'STA', ip: r['IP Address']||'', x:0, y:0, w:180, h:40, meta:r}
      const l = buildNodeLines(n).length
      n.h = Math.max(40, 20 + l*14)
      return n
    })

    const maxAPH = apNodes.length ? Math.max(...apNodes.map(n=>n.h)) : 0
    const maxSTAH = staNodes.length ? Math.max(...staNodes.map(n=>n.h)) : 0

    // Ring radius that fits within group width
    const halfW = gw/2
    const ringWanted = Math.max(120, maxAPH/2 + 60)
    const ringMaxByWidth = Math.max(40, halfW - padding - 90) // 90 = w/2
    const ringR = Math.min(ringWanted, ringMaxByWidth)

    // Compute group height to contain AP(s) and STA ring
    const halfHeightNeeded = Math.max(maxAPH/2, ringR + maxSTAH/2) + padding
    gNode.h = Math.max(220, 2*halfHeightNeeded)
    const cy = gy + gNode.h/2

    // Place AP(s) centered at (cx, cy)
    if(apNodes.length === 1){
      const n = apNodes[0]
      n.x = cx - n.w/2
      n.y = cy - n.h/2
    } else if(apNodes.length > 1){
      const gap = 20
      const totalW = apNodes.length*180 + (apNodes.length-1)*gap
      let startX = cx - totalW/2
      apNodes.forEach(n=>{
        n.x = startX
        n.y = cy - n.h/2
        startX += n.w + gap
      })
    }
    apNodes.forEach(n=> nodes.push(n))

    // Place STAs evenly around a circle centered at (cx, cy)
    const nSta = staNodes.length
    if(nSta>0){
      const startAngle = -Math.PI/2
      for(let i=0;i<nSta;i++){
        const n = staNodes[i]
        const theta = startAngle + (2*Math.PI*i)/nSta
        const centerX = cx + ringR * Math.cos(theta)
        const centerY = cy + ringR * Math.sin(theta)
        n.x = centerX - n.w/2
        n.y = centerY - n.h/2
      }
      staNodes.forEach(n=> nodes.push(n))
    }

    // Edges: connect each STA to nearest AP (or group center if none)
    const apCenters = (apNodes.length? apNodes : [{x:cx - 90, y:cy - 20, w:180, h:40}]).map(n=>({x:n.x+n.w/2,y:n.y+n.h/2}))
    staNodes.forEach(sn=>{
      const sC = {x: sn.x + sn.w/2, y: sn.y + sn.h/2}
      let best = apCenters[0], bestD = Infinity
      for(const ac of apCenters){
        const d = Math.hypot(ac.x - sC.x, ac.y - sC.y)
        if(d<bestD){ bestD=d; best=ac }
      }
      edges.push({from: best, to: sC, cls:'ap-link'})
    })

    if(orient==='LR') gx += gNode.w + 40; else gy += gNode.h + 40
  }
  return {groups,nodes,edges}
}

function renderSVG(layout){
  svg.innerHTML = ''
  const pad = 40
  let maxX = 0, maxY = 0

  // groups
  for(const g of layout.groups){
    const r = rectNode(g.x, g.y, g.w, g.h, 'ssid')
    svg.appendChild(r)
    svg.appendChild(textNode(g.x+8, g.y+6, [g.label], ''))
    maxX = Math.max(maxX, g.x+g.w)
    maxY = Math.max(maxY, g.y+g.h)
  }
  // edges
  for(const e of layout.edges){
    svg.appendChild(link(e.from.x, e.from.y, e.to.x, e.to.y, e.cls||''))
  }
  // nodes
  for(const n of layout.nodes){
    const cls = n.kind==='AP'?'ap':''
    svg.appendChild(rectNode(n.x, n.y, n.w, n.h, cls))
    const lines = buildNodeLines(n)
    svg.appendChild(textNode(n.x+6, n.y+8, lines))
    maxX = Math.max(maxX, n.x+n.w)
    maxY = Math.max(maxY, n.y+n.h)
  }

  const vw = Math.max(1600,maxX+pad)
  const vh = Math.max(900,maxY+pad)
  baseViewBox = {x:0,y:0,w:vw,h:vh}
  viewBox = {...baseViewBox}
  applyViewBox()
}

// Draw.io export: build minimal mxGraphModel
function exportDrawio(layout){
  let id = 1
  const cells = []
  const rootId = id++
  cells.push(`<mxCell id="${rootId}"/>`)
  const layerId = id++
  cells.push(`<mxCell id="${layerId}" parent="${rootId}"/>`)

  function addVertex(x,y,w,h,label,style){
    const cellId = id++
    const s = style || 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#334155;fontColor=#e2e8f0;'
    const mx = `<mxCell id="${cellId}" value="${escapeXml(label)}" style="${s}" vertex="1" parent="${layerId}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`
    cells.push(mx)
    return cellId
  }
  function addEdge(srcId, trgId, style){
    const cellId = id++
    const s = style || 'endArrow=block;rounded=1;strokeColor=#64748b;'
    const mx = `<mxCell id="${cellId}" edge="1" parent="${layerId}" source="${srcId}" target="${trgId}"><mxGeometry relative="1" as="geometry"/></mxCell>`
    cells.push(mx)
    return cellId
  }

  const groupCells = new Map()
  for(const g of layout.groups){
    const gid = addVertex(g.x, g.y, g.w, g.h, g.label, 'shape=swimlane;rounded=1;fillColor=#0f172a;strokeColor=#334155;fontColor=#94a3b8;horizontal=0;')
    groupCells.set(g.id, gid)
  }
  const nodeCells = []
  for(const n of layout.nodes){
    const style = n.kind==='AP'
      ? 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#134e4a;strokeColor=#2dd4bf;fontColor=#e2e8f0;'
      : 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#334155;fontColor=#e2e8f0;'
    const label = n.ip?`${n.label}\\n${n.ip}`:n.label
    const cid = addVertex(n.x, n.y, n.w, n.h, label, style)
    nodeCells.push({id:cid, center:{x:n.x+n.w/2, y:n.y+n.h/2}})
  }
  // naive edge connect by nearest centers
  for(const e of layout.edges){
    // find near source/target nodes
    let src=-1, trg=-1, ds=1e9, dt=1e9
    for(const nn of nodeCells){
      const d1=Math.hypot(nn.center.x-e.from.x, nn.center.y-e.from.y)
      const d2=Math.hypot(nn.center.x-e.to.x, nn.center.y-e.to.y)
      if(d1<ds){ ds=d1; src=nn.id }
      if(d2<dt){ dt=d2; trg=nn.id }
    }
    if(src>0 && trg>0) addEdge(src,trg)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net"><diagram name="Mapping"><mxGraphModel><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
  download('mapping.drawio', xml, 'application/xml')
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function download(filename, text, type){
  const blob = new Blob([text], {type:type||'text/plain'})
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

async function handleFile(file){
  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result
    let rows = []
    const type = detectType(file)
    if(type==='csv') rows = parseCSV(text)
    else if(type==='xml') rows = parseXML(text)
    else rows = parseHTML(text)
    currentRecords = rows
    infoPre.textContent = JSON.stringify(rows.slice(0,20), null, 2)
    statusChip.textContent = `${file.name} · ${rows.length} records`
    const layout = computeLayout(rows)
    renderSVG(layout)
  }
  reader.readAsText(file)
}

fileInput.addEventListener('change', (e)=>{
  const f = e.target.files?.[0]
  if(f) handleFile(f)
})

// Drag-n-drop on upload area
const upload = document.querySelector('.upload')
upload.addEventListener('dragover', (e)=>{e.preventDefault(); upload.classList.add('hover')})
upload.addEventListener('dragleave', ()=> upload.classList.remove('hover'))
upload.addEventListener('drop', (e)=>{
  e.preventDefault(); upload.classList.remove('hover')
  const f = e.dataTransfer.files?.[0]
  if(f) handleFile(f)
})

// Buttons
el('#btn-clear').addEventListener('click', ()=>{
  currentRecords = []
  svg.innerHTML = ''
  infoPre.textContent = ''
  statusChip.textContent = 'No file loaded'
  fileInput.value = ''
})

el('#btn-export').addEventListener('click', ()=>{
  if(!currentRecords.length){ alert('Load data first.'); return }
  const layout = computeLayout(currentRecords)
  exportDrawio(layout)
})

el('#btn-load-sample').addEventListener('click', async ()=>{
  const res = await fetch('/mwakazi_net_bst1.csv')
  const txt = await res.text()
  const rows = parseCSV(txt)
  currentRecords = rows
  infoPre.textContent = JSON.stringify(rows.slice(0,20), null, 2)
  statusChip.textContent = `Sample CSV · ${rows.length} records`
  const layout = computeLayout(rows)
  renderSVG(layout)
})
