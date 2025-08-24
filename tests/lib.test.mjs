import { describe, it, expect } from 'vitest'
import { parseCSV, computeLayout, buildDrawioXML, escapeXml } from '../web/lib.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('parseCSV', () => {
  it('parses header and rows', () => {
    const csv = 'A,B\n1,2\n3,4\n'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({A:'1',B:'2'})
  })
  it('handles quoted commas', () => {
    const csv = 'A,B\n"x,y",z\n'
    const rows = parseCSV(csv)
    expect(rows[0]).toEqual({A:'x,y',B:'z'})
  })
})

describe('computeLayout', () => {
  it('groups by SSID and separates AP/STA', () => {
    const rows = [
      { 'Device Name': 'AP1', Mode:'AP', SSID:'G1', 'IP Address':'1.1.1.1' },
      { 'Device Name': 'C1', Mode:'STA', SSID:'G1', 'IP Address':'2.2.2.2' },
      { 'Device Name': 'C2', Mode:'STA', SSID:'G1' }
    ]
    const layout = computeLayout(rows, {ssidCol:'SSID', modeCol:'Mode', nameCol:'Device Name', orient:'LR'})
    expect(layout.groups.length).toBe(1)
    expect(layout.nodes.find(n=>n.kind==='AP')).toBeTruthy()
    expect(layout.nodes.filter(n=>n.kind==='STA').length).toBe(2)
    expect(layout.edges.length).toBe(2)
  })
})

describe('buildDrawioXML', () => {
  it('generates a valid mxGraphModel root', () => {
    const layout = {
      groups:[{id:'g',x:0,y:0,w:100,h:80,label:'G'}],
      nodes:[{id:'n',kind:'AP',label:'AP',ip:'1.1.1.1',x:10,y:10,w:80,h:30}],
      edges:[]
    }
    const xml = buildDrawioXML(layout)
    expect(xml).toContain('<mxGraphModel>')
    expect(xml).toContain('shape=swimlane')
    expect(xml).toContain('shape=rectangle')
  })
})

describe('escapeXml', () => {
  it('escapes special chars', () => {
    expect(escapeXml('<a&"/>')).toBe('&lt;a&amp;&quot;/&gt;')
  })
})

describe('sample CSV integration', () => {
  it('parses sample and produces layout and xml', () => {
    const path = resolve(process.cwd(), 'web', 'mwakazi_net_bst1.csv')
    const txt = readFileSync(path, 'utf-8')
    const rows = parseCSV(txt)
    const layout = computeLayout(rows, {ssidCol:'SSID', modeCol:'Mode', nameCol:'Device Name', orient:'LR'})
    expect(rows.length).toBeGreaterThan(10)
    expect(layout.groups.length).toBeGreaterThan(1)
    const xml = buildDrawioXML(layout)
    expect(xml.length).toBeGreaterThan(100)
  })
})