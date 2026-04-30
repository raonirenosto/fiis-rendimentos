const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

// ===== CONFIG =====
const INPUT_FILE = "entrada.txt";
const OUTPUT_FILE = "resultado.html";

// ===== FUNÇÕES =====
function parseMoney(valor) {
  return parseFloat(
    valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
  );
}

function parseNumber(valor) {
  return parseFloat(valor.replace(/\./g, "").replace(",", "."));
}

function getMesAno(dataStr) {
  const [dia, mes, ano] = dataStr.split("/");
  return `${ano}-${mes}`;
}

function formatMes(mesStr) {
  const [ano, mes] = mesStr.split("-");
  const meses = [
    "Janeiro","Fevereiro","Março","Abril",
    "Maio","Junho","Julho","Agosto",
    "Setembro","Outubro","Novembro","Dezembro"
  ];
  return `${meses[parseInt(mes) - 1]} ${ano}`;
}

// ===== LEITURA =====
const raw = fs.readFileSync(INPUT_FILE, "utf-8");
const linhas = raw.split("\n").map(l => l.trim()).filter(l => l);

// ===== PARSE =====
let registros = [];

for (let i = 0; i < linhas.length; i += 10) {
  const ticker = linhas[i];

  // apenas FIIs e remove PVBI11
  if (!ticker.endsWith("11") || ticker === "PVBI11") continue;

  registros.push({
    ticker,
    mes: getMesAno(linhas[i + 5]),
    qtd: parseNumber(linhas[i + 6]),
    total: parseMoney(linhas[i + 8]),
  });
}

// ===== AGRUPAR =====
const dados = {};
const mesesSet = new Set();

for (const r of registros) {
  mesesSet.add(r.mes);

  if (!dados[r.ticker]) dados[r.ticker] = {};
  if (!dados[r.ticker][r.mes]) {
    dados[r.ticker][r.mes] = { qtd: r.qtd, total: 0 };
  }

  dados[r.ticker][r.mes].total += r.total;
}

// ===== VALOR POR COTA =====
for (const ticker in dados) {
  for (const mes in dados[ticker]) {
    const d = dados[ticker][mes];
    d.valorPorCota = Number((d.total / d.qtd).toFixed(4));
  }
}

// ===== ORDENAR =====
const meses = Array.from(mesesSet).sort();
const tickers = Object.keys(dados).sort();

// ===== BASELINE =====
function encontrarBaseline(mesesOrdenados, dadosTicker) {
  for (let i = 0; i < mesesOrdenados.length; i++) {
    const mes = mesesOrdenados[i];
    const info = dadosTicker[mes];
    if (!info) continue;

    const mesNumero = parseInt(mes.split("-")[1]);

    if (mesNumero === 1 || mesNumero === 7) {
      for (let j = i + 1; j < mesesOrdenados.length; j++) {
        if (dadosTicker[mesesOrdenados[j]]) {
          return mesesOrdenados[j];
        }
      }
    }

    return mes;
  }
  return null;
}

// ===== HTML =====
let html = `
<html>
<head>
<meta charset="UTF-8">
<style>
body {
  font-family: "Segoe UI", Arial;
  background: #eef4ff;
  padding: 30px;
}

.container {
  max-width: 1600px;
  margin: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 6px 16px rgba(0,0,0,0.08);
}

thead {
  background: #1e3a8a;
  color: white;
}

th, td {
  padding: 10px;
  text-align: center;
}

/* zebra */
tbody tr:nth-child(even) { background: #e8f0ff; }
tbody tr:nth-child(odd) { background: #ffffff; }

/* evita quebra */
.valor {
  white-space: nowrap;
  font-weight: 600;
}

.ticker {
  font-weight: bold;
  background: #c7dbff;
}

.orange { background: #ffe9cc !important; }
.green { background: #e6ffed !important; color: #166534; }
.red { background: #ffe5e5 !important; color: #b91c1c; }

.col-var {
  font-weight: bold;
  white-space: nowrap;
}
</style>
</head>

<body>
<div class="container">
<h2>📊 Dividendos por Cota</h2>

<table>
<thead>
<tr>
<th>Ticker</th>
${meses.map(m => `<th>${formatMes(m)}</th>`).join("")}
<th>% Var</th>
</tr>
</thead>
<tbody>
`;

// ===== PREENCHER =====
for (const ticker of tickers) {
  const dadosTicker = dados[ticker];

  const baselineMes = encontrarBaseline(meses, dadosTicker);
  const mesesValidos = meses.filter(m => dadosTicker[m]);
  const ultimoMes = mesesValidos[mesesValidos.length - 1];

  const base = baselineMes ? dadosTicker[baselineMes].valorPorCota : null;
  const ultimo = ultimoMes ? dadosTicker[ultimoMes].valorPorCota : null;

  let variacao = null;
  if (base && ultimo) {
    variacao = ((ultimo - base) / base) * 100;
  }

  html += `<tr><td class="ticker">${ticker}</td>`;

  for (const mes of meses) {
    const atual = dadosTicker[mes];

    if (!atual) {
      html += `<td>-</td>`;
      continue;
    }

    let classe = "";

    if (mes === baselineMes) classe = "orange";

    if (mes === ultimoMes && base !== null) {
      const diff = atual.valorPorCota - base;
      const tol = 0.0001;

      if (diff > tol) classe = "green";
      else if (diff < -tol) classe = "red";
    }

    html += `
      <td class="${classe}">
        <span class="valor">R$ ${atual.valorPorCota.toFixed(2)}</span>
      </td>
    `;
  }

  // coluna %
  let classeVar = "";
  let textoVar = "-";

  if (variacao !== null) {
    if (variacao > 0.01) classeVar = "green";
    else if (variacao < -0.01) classeVar = "red";

    textoVar = `${variacao.toFixed(2)}%`;
  }

  html += `<td class="col-var ${classeVar}">${textoVar}</td>`;
  html += `</tr>`;
}

html += `
</tbody>
</table>
</div>
</body>
</html>
`;

// ===== SALVAR =====
fs.writeFileSync(OUTPUT_FILE, html);

console.log("HTML gerado:", OUTPUT_FILE);

// ===== ABRIR =====
const filePath = path.resolve(OUTPUT_FILE);

let comando;
if (process.platform === "win32") comando = `start "" "${filePath}"`;
else if (process.platform === "darwin") comando = `open "${filePath}"`;
else comando = `xdg-open "${filePath}"`;

exec(comando);