const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const { lerListaFiis, lerCache, salvarCache, mergeRendimentos } = require("./dados");
const { buscarDividendos } = require("./api");

// ===== CONFIG =====
const OUTPUT_FILE = "resultado.html";

// ===== FUNÇÕES =====
function getMesAno(dataStr) {
  const [dia, mes, ano] = dataStr.split("/");
  return `${ano}-${mes}`;
}

function getAno(mesStr) {
  return mesStr.split("-")[0];
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

// ===== GERAÇÃO HTML =====
function gerarHTML(registrosParam) {
  const cache = registrosParam || lerCache();
  const fiis = lerListaFiis();

  // Filtrar apenas FIIs da lista (termina em 11)
  const registros = cache.filter(r => fiis.includes(r.ticker) && r.ticker.endsWith("11"));

  // Agrupar por ticker e mês (usando data_pagamento)
  const dados = {};
  const mesesSet = new Set();

  for (const r of registros) {
    const mes = getMesAno(r.data_pagamento);
    mesesSet.add(mes);

    if (!dados[r.ticker]) dados[r.ticker] = {};
    if (!dados[r.ticker][mes]) {
      dados[r.ticker][mes] = { valorPorCota: 0 };
    }
    dados[r.ticker][mes].valorPorCota += r.valor_por_cota;
  }

  // Arredondar valores
  for (const ticker in dados) {
    for (const mes in dados[ticker]) {
      dados[ticker][mes].valorPorCota = Number(dados[ticker][mes].valorPorCota.toFixed(4));
    }
  }

  const meses = Array.from(mesesSet).sort();
  const tickers = Object.keys(dados).sort();
  const anos = [...new Set(meses.map(m => getAno(m)))];

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

select {
  padding: 6px 10px;
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

tbody tr:nth-child(even) { background: #e8f0ff; }

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

<select id="filtroAno" onchange="filtrarAno()">
  <option value="todos">Todos</option>
  ${anos.map(a => `<option value="${a}">${a}</option>`).join("")}
</select>

<br><br>

<table>
<thead>
<tr>
<th>Ticker</th>
${meses.map(m => `<th data-ano="${getAno(m)}">${formatMes(m)}</th>`).join("")}
<th>% Var</th>
</tr>
</thead>
<tbody>
`;

  for (const ticker of tickers) {
    html += `<tr><td class="ticker">${ticker}</td>`;

    for (const mes of meses) {
      const atual = dados[ticker][mes];

      if (!atual) {
        html += `<td data-ano="${getAno(mes)}">-</td>`;
        continue;
      }

      html += `
      <td data-ano="${getAno(mes)}">
        <span class="valor">R$ ${atual.valorPorCota.toFixed(2)}</span>
      </td>
    `;
    }

    html += `<td class="col-var">-</td>`;
    html += `</tr>`;
  }

  html += `
</tbody>
</table>
</div>

<script>
function limparClasses(td) {
  td.classList.remove("orange","green","red");
}

function calcularTabela() {
  const anoSelecionado = document.getElementById("filtroAno").value;

  const linhas = document.querySelectorAll("tbody tr");

  linhas.forEach(linha => {
    const celulas = linha.querySelectorAll("td[data-ano]");
    const celulaVar = linha.querySelector(".col-var");

    let dados = [];

    celulas.forEach(td => {
      const ano = td.dataset.ano;
      const texto = td.innerText.trim();

      if (!texto || texto === "-") return;

      const valor = parseFloat(texto.replace("R$", "").replace(",", "."));

      if (anoSelecionado === "todos" || ano === anoSelecionado) {
        dados.push({ td, valor, ano });
      }

      limparClasses(td);
    });

    if (dados.length === 0) {
      celulaVar.innerText = "-";
      celulaVar.classList.remove("green","red");
      return;
    }

    // baseline
    let baselineIndex = 0;

    for (let i = 0; i < dados.length; i++) {
      const th = document.querySelectorAll("th")[dados[i].td.cellIndex];
      const nomeMes = th.innerText.toLowerCase();

      if (nomeMes.includes("janeiro") || nomeMes.includes("julho")) {
        if (i + 1 < dados.length) {
          baselineIndex = i + 1;
        }
      } else {
        baselineIndex = i;
      }
      break;
    }

    const baseline = dados[baselineIndex];
    const ultimo = dados[dados.length - 1];

    baseline.td.classList.add("orange");

    const diff = ultimo.valor - baseline.valor;
    const tol = 0.0001;

    if (diff > tol) ultimo.td.classList.add("green");
    else if (diff < -tol) ultimo.td.classList.add("red");

    let variacao = ((ultimo.valor - baseline.valor) / baseline.valor) * 100;

    if (!isNaN(variacao)) {
      celulaVar.innerText = variacao.toFixed(2) + "%";
      celulaVar.classList.remove("green","red");

      if (variacao > 0.01) celulaVar.classList.add("green");
      else if (variacao < -0.01) celulaVar.classList.add("red");
    } else {
      celulaVar.innerText = "-";
    }
  });
}

function filtrarAno() {
  const ano = document.getElementById("filtroAno").value;

  const ths = document.querySelectorAll("th[data-ano]");
  const tds = document.querySelectorAll("td[data-ano]");

  if (ano === "todos") {
    ths.forEach(th => th.style.display = "");
    tds.forEach(td => td.style.display = "");
  } else {
    ths.forEach(th => {
      th.style.display = th.dataset.ano === ano ? "" : "none";
    });

    tds.forEach(td => {
      td.style.display = td.dataset.ano === ano ? "" : "none";
    });
  }

  calcularTabela();
}

window.onload = calcularTabela;
</script>

</body>
</html>
`;

  return html;
}

// ===== MAIN (execução com API) =====
async function main() {
  const fiis = lerListaFiis();
  if (fiis.length === 0) {
    console.log("⚠️ lista_fiis.txt vazio ou não encontrado");
    return;
  }

  console.log(`📋 ${fiis.length} FIIs carregados\n`);

  let cache = lerCache();
  console.log(`💾 Cache: ${cache.length} registros\n`);

  // Buscar dividendos de cada FII na API
  for (const ticker of fiis) {
    try {
      console.log(`🔍 Buscando ${ticker}...`);
      const novos = await buscarDividendos(ticker);
      console.log(`   ✅ ${novos.length} rendimentos encontrados`);
      cache = mergeRendimentos(cache, novos);
    } catch (e) {
      console.log(`   ❌ Erro: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Salvar cache atualizado
  salvarCache(cache);
  console.log(`\n💾 Cache salvo: ${cache.length} registros`);

  // Gerar HTML
  const html = gerarHTML(cache);
  fs.writeFileSync(OUTPUT_FILE, html);
  console.log("HTML gerado:", OUTPUT_FILE);

  // Abrir
  const filePath = path.resolve(OUTPUT_FILE);
  let comando;
  if (process.platform === "win32") comando = `start "" "${filePath}"`;
  else if (process.platform === "darwin") comando = `open "${filePath}"`;
  else comando = `xdg-open "${filePath}"`;
  exec(comando);
}

if (require.main === module) {
  main();
}

module.exports = { gerarHTML };
