const axios = require("axios")
const https = require("https")

const agentSemSSL = new https.Agent({ rejectUnauthorized: false })

async function buscarDividendos(ticker) {
  const tipo = ticker.endsWith("11") ? "fiis" : "acoes"
  const url = `https://investidor10.com.br/${tipo}/${ticker.toLowerCase()}/dividendos/`

  const r = await axios.get(url, {
    httpsAgent: agentSemSSL,
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 15000
  })

  const rendimentos = []
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch
  while ((trMatch = trRegex.exec(r.data)) !== null) {
    const tds = []
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, "").trim())
    }
    if (tds.length >= 4 && tds[0].toLowerCase().includes("dividendo")) {
      const valor = parseFloat(tds[3].replace(/\./g, "").replace(",", "."))
      if (!isNaN(valor) && valor > 0) {
        rendimentos.push({
          ticker,
          data_com: tds[1],
          data_pagamento: tds[2],
          valor_por_cota: valor
        })
      }
    }
  }
  return rendimentos
}

module.exports = { buscarDividendos }
