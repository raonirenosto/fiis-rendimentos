const fs = require("fs")
const path = require("path")
const os = require("os")
const { lerListaFiis, lerCache, salvarCache, mergeRendimentos } = require("./dados")

function tmpFile(name) {
  return path.join(os.tmpdir(), `fiis-test-${Date.now()}-${name}`)
}

describe("lerListaFiis", () => {
  test("lê tickers de um arquivo", () => {
    const p = tmpFile("lista.txt")
    fs.writeFileSync(p, "TGAR11\nTRXF11\nXPLG11\n")
    const result = lerListaFiis(p)
    expect(result).toEqual(["TGAR11", "TRXF11", "XPLG11"])
    fs.unlinkSync(p)
  })

  test("ignora linhas vazias e inválidas", () => {
    const p = tmpFile("lista2.txt")
    fs.writeFileSync(p, "TGAR11\n\n  \nabc\nKNRI11\n")
    const result = lerListaFiis(p)
    expect(result).toEqual(["TGAR11", "KNRI11"])
    fs.unlinkSync(p)
  })

  test("retorna vazio se arquivo não existe", () => {
    expect(lerListaFiis("/nao/existe.txt")).toEqual([])
  })
})

describe("lerCache / salvarCache", () => {
  test("salva e lê cache corretamente", () => {
    const p = tmpFile("cache.csv")
    const dados = [
      { ticker: "TGAR11", data_com: "30/12/2024", data_pagamento: "15/01/2025", valor_por_cota: 1.10 },
      { ticker: "TRXF11", data_com: "30/12/2024", data_pagamento: "15/01/2025", valor_por_cota: 2.50 }
    ]
    salvarCache(dados, p)
    const result = lerCache(p)
    expect(result).toHaveLength(2)
    expect(result[0].ticker).toBe("TGAR11")
    expect(result[0].valor_por_cota).toBeCloseTo(1.10)
    expect(result[1].ticker).toBe("TRXF11")
    expect(result[1].valor_por_cota).toBeCloseTo(2.50)
    fs.unlinkSync(p)
  })

  test("retorna vazio se cache não existe", () => {
    expect(lerCache("/nao/existe.csv")).toEqual([])
  })

  test("ordena por data_pagamento ao salvar", () => {
    const p = tmpFile("cache2.csv")
    const dados = [
      { ticker: "XPLG11", data_com: "28/02/2025", data_pagamento: "18/03/2025", valor_por_cota: 0.82 },
      { ticker: "TGAR11", data_com: "30/12/2024", data_pagamento: "15/01/2025", valor_por_cota: 1.10 }
    ]
    salvarCache(dados, p)
    const result = lerCache(p)
    expect(result[0].data_pagamento).toBe("15/01/2025")
    expect(result[1].data_pagamento).toBe("18/03/2025")
    fs.unlinkSync(p)
  })
})

describe("mergeRendimentos", () => {
  test("adiciona novos rendimentos sem duplicar", () => {
    const cache = [
      { ticker: "TGAR11", data_com: "30/12/2024", data_pagamento: "15/01/2025", valor_por_cota: 1.10 }
    ]
    const novos = [
      { ticker: "TGAR11", data_com: "30/12/2024", data_pagamento: "15/01/2025", valor_por_cota: 1.10 },
      { ticker: "TGAR11", data_com: "31/01/2025", data_pagamento: "14/02/2025", valor_por_cota: 1.00 }
    ]
    const result = mergeRendimentos(cache, novos)
    expect(result).toHaveLength(2)
    expect(result[1].data_pagamento).toBe("14/02/2025")
  })

  test("não duplica registros idênticos", () => {
    const cache = [
      { ticker: "TRXF11", data_com: "30/12/2024", data_pagamento: "15/01/2025", valor_por_cota: 2.50 }
    ]
    const novos = [
      { ticker: "TRXF11", data_com: "30/12/2024", data_pagamento: "15/01/2025", valor_por_cota: 2.50 }
    ]
    const result = mergeRendimentos(cache, novos)
    expect(result).toHaveLength(1)
  })

  test("merge vazio com novos retorna novos", () => {
    const novos = [
      { ticker: "HGLG11", data_com: "31/07/2025", data_pagamento: "14/08/2025", valor_por_cota: 1.10 }
    ]
    const result = mergeRendimentos([], novos)
    expect(result).toEqual(novos)
  })
})

describe("geração HTML", () => {
  test("fiis.js gera resultado.html a partir do cache", () => {
    // Prepara cache de teste
    const cacheFile = path.resolve(__dirname, "cache_rendimentos.csv")
    const listaFile = path.resolve(__dirname, "lista_fiis.txt")
    const backupCache = fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile) : null
    const backupLista = fs.existsSync(listaFile) ? fs.readFileSync(listaFile) : null

    fs.writeFileSync(listaFile, "TGAR11\nTRXF11\n")
    fs.writeFileSync(cacheFile, `ticker;data_com;data_pagamento;valor_por_cota
TGAR11;30/12/2024;15/01/2025;1.10
TGAR11;31/01/2025;14/02/2025;1.00
TRXF11;30/12/2024;15/01/2025;2.50
TRXF11;31/01/2025;14/02/2025;0.93
`)

    // Executa geração offline (sem API)
    const { gerarHTML } = require("./fiis")
    const html = gerarHTML()

    expect(html).toContain("TGAR11")
    expect(html).toContain("TRXF11")
    expect(html).toContain("Dividendos por Cota")
    expect(html).toContain("R$")
    expect(html).toContain("% Var")

    // Restaura
    if (backupCache) fs.writeFileSync(cacheFile, backupCache)
    else if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile)
    if (backupLista) fs.writeFileSync(listaFile, backupLista)
    else if (fs.existsSync(listaFile)) fs.unlinkSync(listaFile)
  })
})
