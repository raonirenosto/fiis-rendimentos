const fs = require("fs")
const path = require("path")

const LISTA_FILE = path.resolve(__dirname, "lista_fiis.txt")
const CACHE_FILE = path.resolve(__dirname, "cache_rendimentos.csv")

function lerListaFiis(filePath) {
  const p = filePath || LISTA_FILE
  if (!fs.existsSync(p)) return []
  return fs.readFileSync(p, "utf-8")
    .split(/[\r\n]+/)
    .map(l => l.trim().toUpperCase())
    .filter(l => l && l.match(/^[A-Z]{4}\d+$/))
}

function lerCache(filePath) {
  const p = filePath || CACHE_FILE
  if (!fs.existsSync(p)) return []
  const linhas = fs.readFileSync(p, "utf-8").split(/\r?\n/).filter(l => l.trim())
  if (linhas.length < 2) return []
  return linhas.slice(1).map(l => {
    const [ticker, data_com, data_pagamento, valor_por_cota] = l.split(";")
    return { ticker, data_com, data_pagamento, valor_por_cota: parseFloat(valor_por_cota) }
  }).filter(r => r.ticker && !isNaN(r.valor_por_cota))
}

function salvarCache(registros, filePath) {
  const p = filePath || CACHE_FILE
  let csv = "ticker;data_com;data_pagamento;valor_por_cota\n"
  const ordenados = registros.slice().sort((a, b) => {
    const da = a.data_pagamento.split("/").reverse().join("")
    const db = b.data_pagamento.split("/").reverse().join("")
    if (da !== db) return da.localeCompare(db)
    return a.ticker.localeCompare(b.ticker)
  })
  for (const r of ordenados) {
    csv += `${r.ticker};${r.data_com};${r.data_pagamento};${r.valor_por_cota}\n`
  }
  fs.writeFileSync(p, csv)
}

function mergeRendimentos(cache, novos) {
  const chaves = new Set(cache.map(r => `${r.ticker}|${r.data_pagamento}|${r.valor_por_cota}`))
  const merged = [...cache]
  for (const r of novos) {
    const chave = `${r.ticker}|${r.data_pagamento}|${r.valor_por_cota}`
    if (!chaves.has(chave)) {
      merged.push(r)
      chaves.add(chave)
    }
  }
  return merged
}

module.exports = { lerListaFiis, lerCache, salvarCache, mergeRendimentos, CACHE_FILE, LISTA_FILE }
