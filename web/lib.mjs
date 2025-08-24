// Core logic usable in browser and Node tests

export function parseCSV(text){
  const lines = String(text).split(/\r?\n/).filter(Boolean)
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

export function groupBy(data, key){
  const g = new Map()
  for(const row of data){
    const k = ((row?.[key])||'Unknown').trim()
    const arr = g.get(k) || []
    arr.push(row)
    g.set(k, arr)
  }
  return g
}

export function computeLayout(records, opts={}){
  const modeKey = opts.modeCol || 'Mode'
  const nameKey = opts.nameCol || 'Device Name'
  const ssidKey = opts.ssidCol || 'SSID'
  const orient = opts.orient || 'LR'
  const bySSID = groupBy(records, ssidKey)

  const groups = []
  const nodes = []
  const edges = []
  let gx = 40, gy = 40
  const gw = 440, gh = 220

  for(const [ssid, rows] of bySSID){
    const groupId = `g_${ssid}`
    const ap = rows.filter(r => (r[modeKey]||'').toUpperCase()==='AP')
    const sta = rows.filter(r => (r[modeKey]||'').toUpperCase()!=='AP')

    groups.push({ id: groupId, type:'group', label: ssid||'Unknown', x: gx, y: gy, w: gw, h: gh })

    const apStartX = gx+20, apStartY = gy+30
    const staStartX = gx+20, staStartY = gy+110
    const colW = 200, rowH = 60

    ap.forEach((r,i)=>{
      const x = apStartX + (i%2)*colW
      const y = apStartY + Math.floor(i/2)*rowH
      const id = `n_${ssid}_${i}_ap`
      nodes.push({id, kind:'AP', label: r[nameKey]||'AP', ip: r['IP Address']||'', x, y, w: 180, h: 40})
    })
    sta.forEach((r,i)=>{
      const x = staStartX + (i%2)*colW
      const y = staStartY + Math.floor(i/2)*rowH
      const id = `n_${ssid}_${i}_sta`
      nodes.push({id, kind:'STA', label: r[nameKey]||'STA', ip: r['IP Address']||'', x, y, w: 180, h: 40})
    })

    if(ap.length){
      const apX = apStartX+90, apY = apStartY+20
      sta.forEach((r,i)=>{
        const sx = staStartX + (i%2)*colW + 90
        const sy = staStartY + Math.floor(i/2)*rowH + 20
        edges.push({from:{x:apX,y:apY}, to:{x:sx,y:sy}, cls:'ap-link'})
      })
    }

    if(orient==='LR') gx += gw + 40; else gy += gh + 40
  }
  return {groups,nodes,edges}
}

export function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function buildDrawioXML(layout){
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

  const nodeCells = []
  for(const g of layout.groups){
    addVertex(g.x, g.y, g.w, g.h, g.label, 'shape=swimlane;rounded=1;fillColor=#0f172a;strokeColor=#334155;fontColor=#94a3b8;horizontal=0;')
  }
  for(const n of layout.nodes){
    const style = n.kind==='AP'
      ? 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#134e4a;strokeColor=#2dd4bf;fontColor=#e2e8f0;'
      : 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#334155;fontColor=#e2e8f0;'
    const m = n.meta || {}
    const parts = []
    if(m['Device Name'] || n.label) parts.push(`Device Name: ${m['Device Name'] || n.label}`)
    if(m['MAC Address']) parts.push(`MAC Address: ${m['MAC Address']}`)
    if(m['Mode'] || n.kind) parts.push(`Mode: ${m['Mode'] || n.kind}`)
    if(m['SSID']) parts.push(`SSID: ${m['SSID']}`)
    if(m['Product']) parts.push(`Product: ${m['Product']}`)
    if(m['Firmware']) parts.push(`Firmware: ${m['Firmware']}`)
    if(m['IP Address'] || n.ip) parts.push(`IP Address: ${m['IP Address'] || n.ip}`)
    const label = parts.join('\n')
    const cid = addVertex(n.x, n.y, n.w, n.h, label, style)
    nodeCells.push({id:cid, center:{x:n.x+n.w/2, y:n.y+n.h/2}})
  }
  for(const e of layout.edges){
    let src=-1, trg=-1, ds=1e9, dt=1e9
    for(const nn of nodeCells){
      const d1=Math.hypot(nn.center.x-e.from.x, nn.center.y-e.from.y)
      const d2=Math.hypot(nn.center.x-e.to.x, nn.center.y-e.to.y)
      if(d1<ds){ ds=d1; src=nn.id }
      if(d2<dt){ dt=d2; trg=nn.id }
    }
    if(src>0 && trg>0) addEdge(src,trg)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net"><diagram name="Mapping"><mxGraphModel><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
}
