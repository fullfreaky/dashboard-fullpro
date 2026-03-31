"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, ReferenceArea,
} from "recharts";
import { fetchDashboard } from "@/lib/api";
import BrazilMap from "@/components/BrazilMap";

const CONTAS_ALL = ["fullpro", "onroad", "darkstorm", "distribuidora"];
const CONTA_LABELS = { fullpro: "FullPro", onroad: "OnRoad", darkstorm: "DarkStorm", distribuidora: "Distrib." };
const ccHex = (c, dark) => {
  const d = { fullpro: "#EF4444", onroad: "#F97316", darkstorm: "#6B7280", distribuidora: "#3B82F6" };
  const l = { fullpro: "#DC2626", onroad: "#EA580C", darkstorm: "#4B5563", distribuidora: "#2563EB" };
  return (dark ? d : l)[c] || "#6B7A8D";
};

const fmt = (n) => { if (n == null) return "–"; const v = Number(n); if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`; return v.toLocaleString("pt-BR"); };
const fmtR = (n) => { if (n == null) return "–"; const v = Number(n); if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`; if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}k`; return `R$ ${v.toLocaleString("pt-BR")}`; };
const fmtP = (n) => (n == null ? "–" : `${Number(n).toFixed(1)}%`);
const ds = (d) => d.toISOString().split("T")[0];
const tickF = (v) => { const d = new Date(v + "T12:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; };
const isWE = (d) => { const day = new Date(d + "T12:00:00").getDay(); return day === 0 || day === 6; };

/* ── helpers ── */
function Delta({ cur, prev, invert }) {
  if (prev == null || prev == 0 || cur == null) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span style={{ fontSize: 8, fontWeight: 700, color: good ? "var(--green)" : "var(--red)", marginLeft: 3, whiteSpace: "nowrap" }}>
      {up ? "\u25B2" : "\u25BC"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/* ── components ── */
function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: color, borderRadius: "10px 0 0 10px" }} />
      <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", fontFamily: "var(--mono)", letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Sec({ children, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, marginTop: 26 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>{children}</h2>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function MTab({ on, children, onClick }) {
  return <button onClick={onClick} style={{ padding: "4px 10px", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: on ? "var(--accent)" : "transparent", color: on ? "#000" : "var(--muted)", transition: "all .15s" }}>{children}</button>;
}

function Tag({ on, children, onClick, color }) {
  return <button onClick={onClick} style={{ padding: "4px 11px", fontSize: 10, fontWeight: 600, borderRadius: 5, cursor: "pointer", transition: "all .15s", border: `1px solid ${on ? (color || "var(--accent)") : "var(--border)"}`, background: on ? (color || "var(--accent)") + "22" : "var(--card)", color: on ? (color || "var(--accent)") : "var(--muted)" }}>{children}</button>;
}

function ChartTT({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 11px", fontSize: 10, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>
      <div style={{ color: "var(--muted)", marginBottom: 3, fontWeight: 700 }}>{label}</div>
      {payload.filter((p) => p.value > 0).map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ color: "var(--muted)" }}>{p.name}:</span>
          <span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>{formatter ? formatter(p.value, p.name) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, gap: 6 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: `pulse-dot 1.2s ease ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

/* ══ MAIN ══ */
export default function Home() {
  const [dark, setDark] = useState(true);
  const [section, setSection] = useState("ml"); // "ml" or "gestao"
  const [tab, setTab] = useState("vendas");
  const [contas, setContas] = useState([...CONTAS_ALL]);
  const [preset, setPreset] = useState("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDP, setShowDP] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [data, setData] = useState({ kpis: {}, kpis_prev: {}, vendas_dia: [], vendas_dia_prev: [], por_conta: [], top_estados: [], reclamacoes: [], pub_dia: [], pub_conta: [], pub_conta_prev: [], top_produtos: [], top_produtos_prev: [], all_produtos_cur: [], top_categorias: [], top_categorias_prev: [] });

  /* ── produtos state ── */
  const [prodFilter, setProdFilter] = useState("");
  const [prodShow, setProdShow] = useState(20);

  /* ── gestão state ── */
  const [gestaoMode, setGestaoMode] = useState("sku"); // "sku" or "categoria"
  const [gestaoSku, setGestaoSku] = useState("");
  const [gestaoCatId, setGestaoCatId] = useState("");
  const [gestaoPeriodo, setGestaoPeriodo] = useState("12m"); // "12m", "24m", "ano"
  const [gestaoData, setGestaoData] = useState(null);
  const [gestaoLoading, setGestaoLoading] = useState(false);
  const [gestaoCategorias, setGestaoCategorias] = useState([]);
  const [gestaoSkuInput, setGestaoSkuInput] = useState("");

  useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);

  const toggleConta = (c) => {
    setContas((prev) => {
      if (prev.length === 4) return [c];
      if (prev.length === 1 && prev[0] === c) return [...CONTAS_ALL];
      return prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
    });
  };

  const dates = useMemo(() => {
    if (preset === "custom" && dateFrom && dateTo) return { f: dateFrom, t: dateTo };
    const days = { "7d": 7, "30d": 30, "90d": 90, "12m": 365, all: 1200 }[preset] || 30;
    const d = new Date(); d.setDate(d.getDate() - days);
    return { f: ds(d), t: ds(new Date()) };
  }, [preset, dateFrom, dateTo]);

  const contaW = useMemo(() => {
    if (contas.length === 4) return "";
    return `AND conta IN (${contas.map((c) => `'${c}'`).join(",")})`;
  }, [contas]);

  /* reset produtos pagination on filter/period change */
  useEffect(() => { setProdShow(20); setProdFilter(""); }, [preset, dateFrom, dateTo, contas]);

  const selectPreset = (p) => { setPreset(p); setDateFrom(""); setDateTo(""); setShowDP(false); };
  const applyDates = () => { if (dateFrom && dateTo) { setPreset("custom"); setShowDP(false); } };

  /* ── gestão helpers ── */
  const gestaoDateRange = useMemo(() => {
    const now = new Date();
    let from;
    if (gestaoPeriodo === "24m") {
      from = new Date(now.getFullYear() - 2, now.getMonth(), 1);
    } else if (gestaoPeriodo === "ano") {
      from = new Date(now.getFullYear(), 0, 1);
    } else {
      from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    }
    return { f: ds(from), t: ds(now) };
  }, [gestaoPeriodo]);

  // Load categories list once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchDashboard([
          { name: "cats", sql: `SELECT DISTINCT c.id, c.nome FROM categorias c JOIN nfe_items ni ON ni.categoria_id = c.id WHERE ni.considerar = true ORDER BY c.nome` },
        ]);
        setGestaoCategorias(res.cats || []);
      } catch (e) { console.error("cats load error", e); }
    })();
  }, []);

  const loadGestao = useCallback(async (mode, value) => {
    if (!value) return;
    setGestaoLoading(true); setGestaoData(null);
    const { f, t } = gestaoDateRange;
    try {
      let queries;
      if (mode === "sku") {
        const skuSafe = value.replace(/'/g, "''");
        queries = [
          { name: "resumo", sql: `SELECT ea.sku, ea.quantidade as estoque, ea.preco, ea.precocusto, ni.descricao FROM estoque_atual ea LEFT JOIN (SELECT DISTINCT ON (sku) sku, descricao FROM nfe_items WHERE considerar = true ORDER BY sku, data_emissao DESC) ni ON ni.sku = ea.sku WHERE ea.sku = '${skuSafe}'` },
          { name: "vendas_mes", sql: `SELECT date_trunc('month', ni.data_emissao)::date as mes, round(sum(ni.quantidade)::numeric) as unidades, round(sum(ni.valor_total)::numeric) as faturamento FROM nfe_items ni WHERE ni.considerar = true AND ni.sku = '${skuSafe}' AND ni.data_emissao >= '${f}' GROUP BY mes ORDER BY mes` },
          { name: "vendas_detalhe", sql: `SELECT date_trunc('month', ni.data_emissao)::date as mes, CASE WHEN length(regexp_replace(nh.cliente_doc, '[^0-9]', '', 'g')) > 11 THEN 'CNPJ' ELSE 'CPF' END as tipo, round(sum(ni.quantidade)::numeric) as unidades, round(sum(ni.valor_total)::numeric) as faturamento FROM nfe_items ni JOIN nfe_header nh ON ni.nfe_id_bling = nh.nfe_id_bling WHERE ni.considerar = true AND ni.sku = '${skuSafe}' AND ni.data_emissao >= '2025-11-01' GROUP BY mes, tipo ORDER BY mes, tipo` },
          { name: "estoque_mes", sql: `SELECT DISTINCT ON (date_trunc('month', data)) date_trunc('month', data)::date as mes, quantidade as estoque FROM estoque_historico WHERE sku = '${skuSafe}' AND data >= '${f}' ORDER BY date_trunc('month', data), data DESC` },
        ];
      } else {
        const catId = Number(value);
        queries = [
          { name: "resumo", sql: `SELECT c.nome as categoria, (SELECT count(DISTINCT ni2.sku) FROM nfe_items ni2 WHERE ni2.considerar = true AND ni2.categoria_id = c.id) as total_skus, (SELECT coalesce(sum(ea2.quantidade),0) FROM estoque_atual ea2 WHERE ea2.sku IN (SELECT DISTINCT ni3.sku FROM nfe_items ni3 WHERE ni3.considerar = true AND ni3.categoria_id = c.id)) as estoque_total FROM categorias c WHERE c.id = ${catId}` },
          { name: "vendas_mes", sql: `SELECT date_trunc('month', ni.data_emissao)::date as mes, round(sum(ni.quantidade)::numeric) as unidades, round(sum(ni.valor_total)::numeric) as faturamento FROM nfe_items ni WHERE ni.considerar = true AND ni.categoria_id = ${catId} AND ni.data_emissao >= '${f}' GROUP BY mes ORDER BY mes` },
          { name: "vendas_detalhe", sql: `SELECT date_trunc('month', ni.data_emissao)::date as mes, CASE WHEN length(regexp_replace(nh.cliente_doc, '[^0-9]', '', 'g')) > 11 THEN 'CNPJ' ELSE 'CPF' END as tipo, round(sum(ni.quantidade)::numeric) as unidades, round(sum(ni.valor_total)::numeric) as faturamento FROM nfe_items ni JOIN nfe_header nh ON ni.nfe_id_bling = nh.nfe_id_bling WHERE ni.considerar = true AND ni.categoria_id = ${catId} AND ni.data_emissao >= '2025-11-01' GROUP BY mes, tipo ORDER BY mes, tipo` },
          { name: "estoque_mes", sql: `WITH cat_skus AS (SELECT DISTINCT sku FROM nfe_items WHERE considerar = true AND categoria_id = ${catId}), monthly AS (SELECT DISTINCT ON (eh.sku, date_trunc('month', eh.data)) eh.sku, date_trunc('month', eh.data)::date as mes, eh.quantidade FROM estoque_historico eh JOIN cat_skus cs ON eh.sku = cs.sku WHERE eh.data >= '${f}' ORDER BY eh.sku, date_trunc('month', eh.data), eh.data DESC) SELECT mes, sum(quantidade) as estoque FROM monthly GROUP BY mes ORDER BY mes` },
          { name: "top_skus", sql: `SELECT ni.sku, min(ni.descricao) as descricao, round(sum(ni.quantidade)::numeric) as unidades, round(sum(ni.valor_total)::numeric) as faturamento FROM nfe_items ni WHERE ni.considerar = true AND ni.categoria_id = ${catId} AND ni.data_emissao >= '${f}' GROUP BY ni.sku ORDER BY faturamento DESC LIMIT 15` },
        ];
      }
      const res = await fetchDashboard(queries);
      setGestaoData({
        resumo: (res.resumo || [])[0] || null,
        vendas_mes: res.vendas_mes || [],
        vendas_detalhe: res.vendas_detalhe || [],
        estoque_mes: res.estoque_mes || [],
        top_skus: res.top_skus || [],
      });
    } catch (e) { console.error("gestao load error", e); }
    setGestaoLoading(false);
  }, [gestaoDateRange]);

  // Reload gestao when period changes (if there's already a selection)
  useEffect(() => {
    if (gestaoMode === "sku" && gestaoSku) loadGestao("sku", gestaoSku);
    else if (gestaoMode === "categoria" && gestaoCatId) loadGestao("categoria", gestaoCatId);
  }, [gestaoPeriodo]);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const { f, t } = dates;
    const cw = contaW;
    const cw2 = contas.length < 4 ? `AND conta IN (${contas.map((c) => `'${c}'`).join(",")})` : "";
    const df = new Date(f + "T12:00:00"); const dt = new Date(t + "T12:00:00");
    const span = Math.round((dt - df) / 86400000);
    const pf = new Date(df); pf.setDate(pf.getDate() - span - 1);
    const pt = new Date(df); pt.setDate(pt.getDate() - 1);
    const prevF = ds(pf); const prevT = ds(pt);
    try {
      const res = await fetchDashboard([
        { name: "kpis", sql: `SELECT count(*) as total_vendas, round(sum(receita_produtos)::numeric) as receita, round(avg(receita_produtos)::numeric) as ticket_medio, count(*) filter (where is_publicidade) as via_ads, round(100.0*count(*) filter (where is_publicidade)/nullif(count(*),0),1) as pct_ads, count(*) filter (where reclamacao is not null and reclamacao != 'Sem reclamacao') as reclamacoes, round(100.0*count(*) filter (where reclamacao is not null and reclamacao != 'Sem reclamacao')/nullif(count(*),0),1) as pct_reclamacao, count(*) filter (where status='cancelled') as canceladas, round(100.0*count(*) filter (where status='cancelled')/nullif(count(*),0),1) as pct_cancelada, round(sum(tarifa_venda+tarifa_envio)::numeric) as tarifas_total, round(sum(cancelamentos)::numeric) as valor_cancelamentos, round(sum(receita_envio)::numeric) as receita_frete FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw}` },
        { name: "vendas_dia", sql: `SELECT venda_data::date as dia, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita, count(*) filter (where is_publicidade) as via_ads, count(*) filter (where not is_publicidade) as organico, count(*) filter (where forma_envio='fulfillment') as fulfillment, count(*) filter (where forma_envio!='fulfillment' or forma_envio is null) as normal, count(*) filter (where listing_type='gold_pro') as premium, count(*) filter (where listing_type='gold_special') as classico FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY dia ORDER BY dia` },
        { name: "por_conta", sql: `SELECT conta, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita, round(avg(receita_produtos)::numeric) as ticket_medio, count(*) filter (where is_publicidade) as via_ads, count(*) filter (where reclamacao is not null and reclamacao != 'Sem reclamacao') as reclamacoes, round(sum(cancelamentos)::numeric) as valor_cancelamentos FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY conta ORDER BY receita DESC` },
        { name: "top_estados", sql: `SELECT coalesce(estado,'N/I') as estado, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY estado ORDER BY vendas DESC LIMIT 27` },
        { name: "reclamacoes", sql: `SELECT reclamacao, count(*) as total, round(sum(receita_produtos)::numeric) as receita_envolvida, round(sum(cancelamentos)::numeric) as valor_devolvido FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} AND reclamacao IS NOT NULL AND reclamacao != 'Sem reclamacao' GROUP BY reclamacao ORDER BY total DESC LIMIT 10` },
        { name: "pub_dia", sql: `SELECT data as dia, round(sum(custo)::numeric) as custo, round(sum(total_amount)::numeric) as receita_ads, round((sum(custo)/nullif(sum(total_amount),0)*100)::numeric,1) as acos, round((sum(total_amount)/nullif(sum(custo),0))::numeric,1) as roas, sum(clicks) as clicks, sum(impressoes) as impressoes FROM ml_publicidade_diario WHERE data>='${f}' AND data<='${t}' ${cw2} GROUP BY data ORDER BY data` },
        { name: "pub_conta", sql: `SELECT conta, round(sum(custo)::numeric) as custo, round(sum(total_amount)::numeric) as receita_ads, round((sum(custo)/nullif(sum(total_amount),0)*100)::numeric,1) as acos, round((sum(total_amount)/nullif(sum(custo),0))::numeric,1) as roas, sum(clicks) as clicks, sum(impressoes) as impressoes, round(avg(cvr)::numeric,2) as cvr FROM ml_publicidade_diario WHERE data>='${f}' AND data<='${t}' ${cw2} GROUP BY conta ORDER BY custo DESC` },
        { name: "pub_conta_prev", sql: `SELECT conta, round(sum(custo)::numeric) as custo, round(sum(total_amount)::numeric) as receita_ads, round((sum(custo)/nullif(sum(total_amount),0)*100)::numeric,1) as acos, round((sum(total_amount)/nullif(sum(custo),0))::numeric,1) as roas, sum(clicks) as clicks FROM ml_publicidade_diario WHERE data>='${prevF}' AND data<='${prevT}' ${cw2} GROUP BY conta` },
        { name: "vendas_dia_prev", sql: `SELECT venda_data::date as dia, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita FROM ml_vendas WHERE venda_data::date>='${prevF}' AND venda_data::date<='${prevT}' ${cw} GROUP BY dia ORDER BY dia` },
        { name: "kpis_prev", sql: `SELECT count(*) as total_vendas, round(sum(receita_produtos)::numeric) as receita FROM ml_vendas WHERE venda_data::date>='${prevF}' AND venda_data::date<='${prevT}' ${cw}` },
        { name: "top_produtos", sql: `SELECT coalesce(nullif(sku,''),'N/I') as sku, min(titulo) as titulo, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita, round(avg(receita_produtos)::numeric) as ticket_medio, count(*) filter (where is_publicidade) as via_ads FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY sku ORDER BY receita DESC` },
        { name: "top_produtos_prev", sql: `SELECT coalesce(nullif(sku,''),'N/I') as sku, min(titulo) as titulo, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita FROM ml_vendas WHERE venda_data::date>='${prevF}' AND venda_data::date<='${prevT}' ${cw} GROUP BY sku ORDER BY vendas DESC LIMIT 200` },
        { name: "all_produtos_cur", sql: `SELECT coalesce(nullif(sku,''),'N/I') as sku, count(*) as vendas FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY sku` },
        { name: "top_categorias", sql: `SELECT * FROM top_categorias_proporcional('${f}','${t}','${contas.length < 4 ? contas.join(",") : ""}')` },
        { name: "top_categorias_prev", sql: `SELECT * FROM top_categorias_proporcional('${prevF}','${prevT}','${contas.length < 4 ? contas.join(",") : ""}')` },
      ]);
      setData({
        kpis: (res.kpis || [])[0] || {},
        kpis_prev: (res.kpis_prev || [])[0] || {},
        vendas_dia: res.vendas_dia || [],
        vendas_dia_prev: res.vendas_dia_prev || [],
        por_conta: res.por_conta || [],
        top_estados: res.top_estados || [],
        reclamacoes: res.reclamacoes || [],
        pub_dia: res.pub_dia || [],
        pub_conta: res.pub_conta || [],
        pub_conta_prev: res.pub_conta_prev || [],
        top_produtos: res.top_produtos || [],
        top_produtos_prev: res.top_produtos_prev || [],
        all_produtos_cur: res.all_produtos_cur || [],
        top_categorias: res.top_categorias || [],
        top_categorias_prev: res.top_categorias_prev || [],
      });
    } catch (e) { console.error(e); setErr(e.message); }
    setLoading(false);
  }, [dates, contaW, contas]);

  useEffect(() => { load(); }, [load]);

  const k = data.kpis || {};

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font)" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", background: "var(--card)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: 8, color: "var(--accent)", fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" }}>FullPro</div>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Dashboard</h1>
          </div>
          <div style={{ display: "flex", gap: 2, background: "var(--bg)", padding: 3, borderRadius: 7 }}>
            {[{ id: "ml", l: "Mercado Livre", i: "🛒" }, { id: "gestao", l: "Gestão", i: "📊" }].map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)} style={{ padding: "5px 14px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 5, cursor: "pointer", background: section === s.id ? "var(--accent)" : "transparent", color: section === s.id ? "#000" : "var(--muted)", display: "flex", gap: 4, alignItems: "center", transition: "all .15s" }}>
                <span style={{ fontSize: 12 }}>{s.i}</span>{s.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {section === "ml" && (
            <div style={{ display: "flex", gap: 2, background: "var(--bg)", padding: 2, borderRadius: 6 }}>
              {["7d", "30d", "90d", "12m", "all"].map((p) => (
                <MTab key={p} on={preset === p} onClick={() => selectPreset(p)}>{p === "all" ? "Tudo" : p}</MTab>
              ))}
              <MTab on={preset === "custom" || showDP} onClick={() => setShowDP(!showDP)}>📅</MTab>
            </div>
          )}
          <button onClick={() => setDark((d) => !d)} style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* date picker (ML only) */}
      {section === "ml" && showDP && (
        <div style={{ padding: "10px 22px", background: "var(--card)", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>De:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", fontSize: 12, colorScheme: dark ? "dark" : "light" }} />
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Até:</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", fontSize: 12, colorScheme: dark ? "dark" : "light" }} />
          <button onClick={applyDates} style={{ padding: "5px 14px", fontSize: 11, fontWeight: 700, background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, cursor: "pointer" }}>Aplicar</button>
        </div>
      )}

      {/* conta tags (ML only) */}
      {section === "ml" && (
        <div style={{ padding: "10px 22px", display: "flex", gap: 5, alignItems: "center", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginRight: 2 }}>Contas:</span>
          <Tag on={contas.length === 4} onClick={() => setContas([...CONTAS_ALL])}>Todas</Tag>
          {CONTAS_ALL.map((k) => (
            <Tag key={k} on={contas.includes(k)} onClick={() => toggleConta(k)} color={ccHex(k, dark)}>{CONTA_LABELS[k]}</Tag>
          ))}
          {loading && <span style={{ fontSize: 9, color: "var(--accent)", marginLeft: 8, fontWeight: 600 }}>⏳ Carregando...</span>}
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <div style={{ padding: "18px 22px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ═══ ML SECTION ═══ */}
        {section === "ml" && (<>
          {/* tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 18, background: "var(--card)", padding: 3, borderRadius: 8, width: "fit-content", border: "1px solid var(--border)" }}>
            {[{ id: "vendas", l: "Vendas", i: "📦" }, { id: "produtos", l: "Produtos", i: "🎯" }, { id: "publicidade", l: "Publicidade", i: "📢" }, { id: "problemas", l: "Reclamações", i: "⚠️" }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 16px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6, background: tab === t.id ? "var(--accent)" : "transparent", color: tab === t.id ? "#000" : "var(--muted)", cursor: "pointer", display: "flex", gap: 4, alignItems: "center", transition: "all .15s" }}>
                <span style={{ fontSize: 12 }}>{t.i}</span>{t.l}
              </button>
            ))}
          </div>

          {err && <div style={{ padding: 12, background: "var(--red)" + "22", border: "1px solid var(--red)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "var(--red)" }}>Erro: {err}</div>}

          {loading ? <Loader /> : (<>

          {/* ═══ VENDAS ═══ */}
          {tab === "vendas" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              <KPI label="Receita" value={fmtR(k.receita)} color="var(--green)" />
              <KPI label="Vendas" value={fmt(k.total_vendas)} color="var(--blue)" />
              <KPI label="Ticket Médio" value={fmtR(k.ticket_medio)} color="var(--accent)" />
              <KPI label="Via Ads" value={fmtP(k.pct_ads)} sub={`${fmt(k.via_ads)} vendas`} color="var(--purple)" />
              <KPI label="Tarifas ML" value={fmtR(k.tarifas_total)} color="var(--red)" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              {[
                { title: "Vendas por Dia (qtd)", key: "vendas", prevKey: "vendas", color: dark ? "#3B82F6" : "#2563EB", prevColor: dark ? "#1E3A5F" : "#BFDBFE", fmtFn: fmt, label: "Vendas" },
                { title: "Faturamento por Dia (R$)", key: "receita", prevKey: "receita", color: dark ? "#22C55E" : "#16A34A", prevColor: dark ? "#14532D" : "#BBF7D0", fmtFn: fmtR, label: "Faturamento" },
              ].map((chart) => {
                const prev = data.vendas_dia_prev || [];
                const cur = data.vendas_dia || [];
                const merged = cur.map((d, i) => ({ ...d, [`prev_${chart.key}`]: prev[i] ? Number(prev[i][chart.key]) : 0 }));
                const weekends = cur.filter((d) => isWE(d.dia)).map((d) => d.dia);
                return (
                  <div key={chart.title} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 6px 10px" }}>
                      <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>{chart.title}</h3>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: chart.color }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>Atual</span></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: chart.prevColor, opacity: 0.7 }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>Anterior</span></div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={merged} barCategoryGap="8%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="dia" stroke="var(--dim)" fontSize={8} tickFormatter={tickF} interval={Math.max(0, Math.floor(cur.length / 10))} />
                        <YAxis stroke="var(--dim)" fontSize={8} tickFormatter={chart.key === "receita" ? (v) => fmtR(v) : undefined} />
                        <Tooltip content={<ChartTT formatter={(v, n) => n.includes("Anterior") ? `${chart.fmtFn(v)} (anterior)` : chart.fmtFn(v)} />} />
                        {weekends.map((d) => <ReferenceArea key={d} x1={d} x2={d} fill={dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} />)}
                        <Bar dataKey={`prev_${chart.key}`} name={`${chart.label} Anterior`} fill={chart.prevColor} opacity={0.5} radius={[2, 2, 0, 0]} />
                        <Bar dataKey={chart.key} name={chart.label} fill={chart.color} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>

            {(() => {
              const totals = (data.vendas_dia || []).reduce((a, d) => ({
                ads: (a.ads || 0) + (Number(d.via_ads) || 0),
                org: (a.org || 0) + (Number(d.organico) || 0),
                full: (a.full || 0) + (Number(d.fulfillment) || 0),
                norm: (a.norm || 0) + (Number(d.normal) || 0),
                prem: (a.prem || 0) + (Number(d.premium) || 0),
                clas: (a.clas || 0) + (Number(d.classico) || 0),
              }), {});
              const pies = [
                { title: "Ads vs Orgânico", data: [{ name: "Via Ads", value: totals.ads || 0 }, { name: "Orgânico", value: totals.org || 0 }], colors: [dark ? "#A855F7" : "#7C3AED", dark ? "#22C55E" : "#16A34A"] },
                { title: "Fulfillment vs Normal", data: [{ name: "Fulfillment", value: totals.full || 0 }, { name: "Normal", value: totals.norm || 0 }], colors: [dark ? "#06B6D4" : "#0891B2", dark ? "#F97316" : "#EA580C"] },
                { title: "Premium vs Clássico", data: [{ name: "Premium", value: totals.prem || 0 }, { name: "Clássico", value: totals.clas || 0 }], colors: [dark ? "#F59E0B" : "#D97706", dark ? "#3B82F6" : "#2563EB"] },
              ];
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  {pies.map((p) => {
                    const total = p.data.reduce((a, d) => a + d.value, 0);
                    return (
                      <div key={p.title} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                        <h3 style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 4px" }}>{p.title}</h3>
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <Pie data={p.data} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value" stroke="none">
                              {p.data.map((_, i) => <Cell key={i} fill={p.colors[i]} />)}
                            </Pie>
                            <Tooltip content={<ChartTT formatter={(v, n) => `${fmt(v)} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`} />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 2 }}>
                          {p.data.map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.colors[i] }} />
                              <span style={{ fontSize: 9, color: "var(--muted)" }}>{d.name}</span>
                              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)" }}>{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>Por Conta</h3>
                {(data.por_conta || []).map((c) => {
                  const mx = Math.max(...(data.por_conta || []).map((x) => x.receita || 0), 1);
                  return (
                    <div key={c.conta} style={{ marginBottom: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: ccHex(c.conta, dark) }} />
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{CONTA_LABELS[c.conta] || c.conta}</span>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700 }}>{fmtR(c.receita)}</span>
                      </div>
                      <div style={{ height: 4, background: "var(--bg)", borderRadius: 2 }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${(c.receita / mx) * 100}%`, background: ccHex(c.conta, dark), transition: "width .5s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 8, color: "var(--muted)" }}>{fmt(c.vendas)} vendas</span>
                        <span style={{ fontSize: 8, color: "var(--muted)" }}>TM {fmtR(c.ticket_medio)}</span>
                        <span style={{ fontSize: 8, color: "var(--purple)" }}>{fmt(c.via_ads)} ads</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Vendas por Estado</h3>
                <BrazilMap estados={data.top_estados || []} dark={dark} />
              </div>
            </div>
          </>)}

          {/* ═══ PRODUTOS ═══ */}
          {tab === "produtos" && (<>
            {(() => {
              const allProd = data.top_produtos || [];
              const prevMap = {};
              (data.top_produtos_prev || []).forEach((p) => { prevMap[p.sku] = p; });
              const curAllMap = {};
              (data.all_produtos_cur || []).forEach((p) => { curAllMap[p.sku] = p; });

              // Filter products by search term (sku or titulo)
              const filterLow = prodFilter.toLowerCase().trim();
              const filtered = filterLow
                ? allProd.filter((p) => (p.sku || "").toLowerCase().includes(filterLow) || (p.titulo || "").toLowerCase().includes(filterLow))
                : allProd;
              const visible = filtered.slice(0, prodShow);
              const hasMore = filtered.length > prodShow;

              // Produtos que mais perderam vendas (min 3 no anterior, excluir N/I)
              const perderam = Object.entries(prevMap)
                .filter(([sku, p]) => sku !== "N/I" && Number(p.vendas) >= 3)
                .map(([sku, p]) => {
                  const c = curAllMap[sku];
                  const curV = c ? Number(c.vendas) : 0;
                  const prevV = Number(p.vendas);
                  return { sku, titulo: p.titulo || sku, vendas_atual: curV, vendas_anterior: prevV, diff: curV - prevV, pct: prevV > 0 ? ((curV - prevV) / prevV * 100) : 0 };
                })
                .filter((x) => x.diff < 0)
                .sort((a, b) => a.diff - b.diff)
                .slice(0, 30);
              // Categorias
              const catCur = data.top_categorias || [];
              const catPrevMap = {};
              (data.top_categorias_prev || []).forEach((c) => { catPrevMap[c.categoria] = c; });
              return (<>
                <Sec icon="🏆">Top Produtos</Sec>
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px", overflowX: "auto" }}>
                  {/* Search filter */}
                  <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--dim)", pointerEvents: "none" }}>🔍</span>
                      <input
                        type="text"
                        value={prodFilter}
                        onChange={(e) => { setProdFilter(e.target.value); setProdShow(20); }}
                        placeholder="Filtrar por SKU ou título..."
                        style={{
                          width: "100%", padding: "8px 12px 8px 34px", fontSize: 13,
                          background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)",
                          borderRadius: 8, outline: "none", fontFamily: "var(--font)",
                          transition: "border-color .15s",
                        }}
                        onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                        onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap" }}>
                      {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {/* Table header */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, padding: "0 0 8px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ width: 28, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>#</span>
                    <span style={{ flex: 1, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Produto</span>
                    <span style={{ width: 65, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Vendas</span>
                    <span style={{ width: 65, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Anterior</span>
                    <span style={{ width: 55, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Var %</span>
                    <span style={{ width: 90, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Receita</span>
                    <span style={{ width: 45, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Ads</span>
                  </div>
                  {/* Table rows */}
                  {visible.length === 0 && (
                    <div style={{ textAlign: "center", padding: 28, color: "var(--muted)", fontSize: 13 }}>
                      {prodFilter ? "Nenhum produto encontrado" : "Sem dados no período"}
                    </div>
                  )}
                  {visible.map((p, i) => {
                    const prev = prevMap[p.sku];
                    const prevV = prev ? Number(prev.vendas) : 0;
                    const diff = prevV > 0 ? ((Number(p.vendas) - prevV) / prevV * 100) : null;
                    return (
                      <div key={p.sku + i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: i < visible.length - 1 ? "1px solid var(--border)11" : "none" }}>
                        <span style={{ width: 28, fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)", fontWeight: 600 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{p.titulo}</div>
                          <div style={{ fontSize: 9, color: "var(--dim)", fontFamily: "var(--mono)", marginTop: 1 }}>{p.sku}</div>
                        </div>
                        <span style={{ width: 65, fontSize: 13, fontFamily: "var(--mono)", fontWeight: 700, textAlign: "right" }}>{fmt(p.vendas)}</span>
                        <span style={{ width: 65, fontSize: 12, fontFamily: "var(--mono)", color: "var(--muted)", textAlign: "right" }}>{prevV > 0 ? fmt(prevV) : "–"}</span>
                        <span style={{ width: 55, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right", color: diff == null ? "var(--muted)" : diff >= 0 ? "var(--green)" : "var(--red)" }}>{diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%` : "–"}</span>
                        <span style={{ width: 90, fontSize: 13, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right", color: "var(--accent)" }}>{fmtR(p.receita)}</span>
                        <span style={{ width: 45, fontSize: 11, fontFamily: "var(--mono)", textAlign: "right", color: Number(p.via_ads) > 0 ? "var(--purple)" : "var(--dim)" }}>{fmt(p.via_ads)}</span>
                      </div>
                    );
                  })}
                  {/* Load more */}
                  {hasMore && (
                    <div style={{ textAlign: "center", paddingTop: 14 }}>
                      <button
                        onClick={() => setProdShow((s) => s + 20)}
                        style={{
                          padding: "8px 28px", fontSize: 12, fontWeight: 600,
                          background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)",
                          borderRadius: 8, cursor: "pointer", transition: "all .15s",
                        }}
                        onMouseEnter={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--muted)"; }}
                      >
                        Carregar mais ({filtered.length - prodShow} restantes)
                      </button>
                    </div>
                  )}
                </div>

                <Sec icon="📉">Produtos que Mais Perderam Vendas</Sec>
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, overflowX: "auto" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, padding: "0 0 7px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ width: 22, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>#</span>
                    <span style={{ flex: 1, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Produto</span>
                    <span style={{ width: 55, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Atual</span>
                    <span style={{ width: 55, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Anterior</span>
                    <span style={{ width: 50, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Diff</span>
                    <span style={{ width: 45, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Var %</span>
                  </div>
                  {perderam.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 11 }}>Sem dados suficientes para comparação</div>}
                  {perderam.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0", borderBottom: i < perderam.length - 1 ? "1px solid var(--border)11" : "none" }}>
                      <span style={{ width: 22, fontSize: 9, color: "var(--dim)", fontFamily: "var(--mono)", fontWeight: 600 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</div>
                        <div style={{ fontSize: 7, color: "var(--dim)", fontFamily: "var(--mono)" }}>{p.sku}</div>
                      </div>
                      <span style={{ width: 55, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, textAlign: "right" }}>{fmt(p.vendas_atual)}</span>
                      <span style={{ width: 55, fontSize: 10, fontFamily: "var(--mono)", color: "var(--muted)", textAlign: "right" }}>{fmt(p.vendas_anterior)}</span>
                      <span style={{ width: 50, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, textAlign: "right", color: "var(--red)" }}>{p.diff}</span>
                      <span style={{ width: 45, fontSize: 9, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right", color: "var(--red)" }}>{p.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>

                <Sec icon="📂">Top Categorias (com decomposição de kits)</Sec>
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, padding: "0 0 7px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Categoria</span>
                    <span style={{ width: 55, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Unids</span>
                    <span style={{ width: 55, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Anterior</span>
                    <span style={{ width: 45, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Var %</span>
                    <span style={{ width: 85, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Receita</span>
                  </div>
                  {catCur.map((c, i) => {
                    const prev = catPrevMap[c.categoria];
                    const curU = Number(c.unidades) || Number(c.vendas);
                    const prevU = prev ? (Number(prev.unidades) || Number(prev.vendas)) : 0;
                    const diff = prevU > 0 ? ((curU - prevU) / prevU * 100) : null;
                    const mx = Number(catCur[0]?.unidades) || Number(catCur[0]?.vendas) || 1;
                    return (
                      <div key={i} style={{ padding: "5px 0", borderBottom: i < catCur.length - 1 ? "1px solid var(--border)11" : "none" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 11, fontWeight: 500, textTransform: "capitalize" }}>{c.categoria}</span>
                          </div>
                          <span style={{ width: 55, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, textAlign: "right" }}>{fmt(curU)}</span>
                          <span style={{ width: 55, fontSize: 10, fontFamily: "var(--mono)", color: "var(--muted)", textAlign: "right" }}>{prevU > 0 ? fmt(prevU) : "–"}</span>
                          <span style={{ width: 45, fontSize: 9, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right", color: diff == null ? "var(--muted)" : diff >= 0 ? "var(--green)" : "var(--red)" }}>{diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%` : "–"}</span>
                          <span style={{ width: 85, fontSize: 10, fontFamily: "var(--mono)", textAlign: "right", color: "var(--accent)" }}>{fmtR(c.receita)}</span>
                        </div>
                        <div style={{ height: 3, background: "var(--bg)", borderRadius: 2, marginTop: 3 }}>
                          <div style={{ height: "100%", borderRadius: 2, width: `${(curU / mx) * 100}%`, background: "var(--blue)", transition: "width .5s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>);
            })()}
          </>)}

          {/* ═══ PUBLICIDADE ═══ */}
          {tab === "publicidade" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              {(() => {
                const t = (data.pub_conta || []).reduce((a, c) => ({ custo: (a.custo || 0) + (c.custo || 0), receita: (a.receita || 0) + (c.receita_ads || 0), clicks: (a.clicks || 0) + (c.clicks || 0), imp: (a.imp || 0) + (c.impressoes || 0) }), {});
                const acos = t.receita > 0 ? (t.custo / t.receita * 100) : 0;
                const roas = t.custo > 0 ? (t.receita / t.custo) : 0;
                return (<>
                  <KPI label="Custo Ads" value={fmtR(t.custo)} color="var(--red)" />
                  <KPI label="Receita Ads" value={fmtR(t.receita)} color="var(--green)" />
                  <KPI label="ACOS" value={fmtP(acos)} sub="Custo / Receita" color="var(--accent)" />
                  <KPI label="ROAS" value={`${roas.toFixed(1)}x`} sub="Receita / Custo" color="var(--blue)" />
                  <KPI label="Clicks" value={fmt(t.clicks)} sub={`${fmt(t.imp)} impressões`} color="var(--purple)" />
                </>);
              })()}
            </div>

            <Sec icon="💰">Custo vs Receita Ads</Sec>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.pub_dia || []}>
                  <defs>
                    <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={dark ? "#EF4444" : "#DC2626"} stopOpacity={.2} /><stop offset="95%" stopColor={dark ? "#EF4444" : "#DC2626"} stopOpacity={0} /></linearGradient>
                    <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={dark ? "#22C55E" : "#16A34A"} stopOpacity={.2} /><stop offset="95%" stopColor={dark ? "#22C55E" : "#16A34A"} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" stroke="var(--dim)" fontSize={9} tickFormatter={tickF} interval={Math.max(0, Math.floor((data.pub_dia || []).length / 15))} />
                  <YAxis stroke="var(--dim)" fontSize={9} tickFormatter={(v) => fmtR(v)} />
                  <Tooltip content={<ChartTT formatter={(v) => fmtR(v)} />} />
                  <Area type="monotone" dataKey="receita_ads" name="Receita" stroke={dark ? "#22C55E" : "#16A34A"} fill="url(#gr)" strokeWidth={2} />
                  <Area type="monotone" dataKey="custo" name="Custo" stroke={dark ? "#EF4444" : "#DC2626"} fill="url(#gc)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <Sec icon="📈">ACOS / ROAS</Sec>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.pub_dia || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" stroke="var(--dim)" fontSize={9} tickFormatter={tickF} interval={Math.max(0, Math.floor((data.pub_dia || []).length / 15))} />
                  <YAxis yAxisId="l" stroke={dark ? "#F59E0B" : "#D97706"} fontSize={9} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
                  <YAxis yAxisId="r" orientation="right" stroke={dark ? "#3B82F6" : "#2563EB"} fontSize={9} tickFormatter={(v) => `${v}x`} />
                  <Tooltip content={<ChartTT formatter={(v, n) => n === "ACOS" ? fmtP(v) : `${Number(v).toFixed(1)}x`} />} />
                  <Line yAxisId="l" type="monotone" dataKey="acos" name="ACOS" stroke={dark ? "#F59E0B" : "#D97706"} dot={false} strokeWidth={2} />
                  <Line yAxisId="r" type="monotone" dataKey="roas" name="ROAS" stroke={dark ? "#3B82F6" : "#2563EB"} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <Sec icon="🏪">Por Conta</Sec>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min((data.pub_conta || []).length || 1, 4)},1fr)`, gap: 10 }}>
              {(data.pub_conta || []).map((c) => {
                const prev = (data.pub_conta_prev || []).find((p) => p.conta === c.conta) || {};
                return (
                <div key={c.conta} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${ccHex(c.conta, dark)}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{CONTA_LABELS[c.conta] || c.conta}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    <div>
                      <div style={{ fontSize: 7, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Custo</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--red)", display: "flex", alignItems: "center" }}>{fmtR(c.custo)}<Delta cur={c.custo} prev={prev.custo} invert /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Receita</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--green)", display: "flex", alignItems: "center" }}>{fmtR(c.receita_ads)}<Delta cur={c.receita_ads} prev={prev.receita_ads} /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>ACOS</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)", display: "flex", alignItems: "center" }}>{fmtP(c.acos)}<Delta cur={c.acos} prev={prev.acos} invert /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>ROAS</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)", display: "flex", alignItems: "center" }}>{c.roas ? `${c.roas}x` : "–"}<Delta cur={c.roas} prev={prev.roas} /></div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </>)}

          {/* ═══ RECLAMAÇÕES ═══ */}
          {tab === "problemas" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              <KPI label="Reclamações" value={fmt(k.reclamacoes)} sub={`${fmtP(k.pct_reclamacao)} das vendas`} color="var(--red)" />
              <KPI label="Cancelamentos" value={fmt(k.canceladas)} sub={`${fmtP(k.pct_cancelada)} das vendas`} color="var(--orange)" />
              <KPI label="Valor Devolvido" value={fmtR(k.valor_cancelamentos)} sub="cancelamentos" color="var(--red)" />
              <KPI label="Frete Recebido" value={fmtR(k.receita_frete)} color="var(--cyan)" />
              <KPI label="Vendas OK" value={fmt((k.total_vendas || 0) - (k.canceladas || 0))} color="var(--green)" />
            </div>

            <Sec icon="📋">Tipos de Reclamação</Sec>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, padding: "0 0 7px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ flex: 1, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Tipo</span>
                <span style={{ width: 55, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>Qtd</span>
                <span style={{ width: 85, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>Receita Env.</span>
                <span style={{ width: 85, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>Devolvido</span>
              </div>
              {(data.reclamacoes || []).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "5px 0", borderBottom: i < (data.reclamacoes || []).length - 1 ? "1px solid var(--border)" + "22" : "none" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: r.reclamacao?.includes("opened") ? "var(--red)" : "var(--orange)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{r.reclamacao}</span>
                  </div>
                  <span style={{ width: 55, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right" }}>{fmt(r.total)}</span>
                  <span style={{ width: 85, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right", color: "var(--accent)" }}>{fmtR(r.receita_envolvida)}</span>
                  <span style={{ width: 85, fontSize: 11, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right", color: "var(--red)" }}>{fmtR(r.valor_devolvido)}</span>
                </div>
              ))}
              {(!data.reclamacoes || data.reclamacoes.length === 0) && (
                <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Nenhuma reclamação no período 🎉</div>
              )}
            </div>

            <Sec icon="🏪">Por Conta</Sec>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min((data.por_conta || []).length || 1, 4)},1fr)`, gap: 10 }}>
              {(data.por_conta || []).map((c) => (
                <div key={c.conta} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${ccHex(c.conta, dark)}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7 }}>{CONTA_LABELS[c.conta] || c.conta}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {[{ l: "Reclamações", v: fmt(c.reclamacoes), cl: "var(--red)" }, { l: "% Vendas", v: c.vendas > 0 ? fmtP((c.reclamacoes / c.vendas) * 100) : "–", cl: "var(--text)" }, { l: "Vendas", v: fmt(c.vendas), cl: "var(--muted)" }, { l: "Devolvido", v: fmtR(c.valor_cancelamentos), cl: "var(--red)" }].map((m, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 7, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>{m.l}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--mono)", color: m.cl }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>)}

          </>)}
        </>)}

        {/* ═══ GESTÃO SECTION ═══ */}
        {section === "gestao" && (<>
            {/* Period selector + mode toggle */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 2, background: "var(--bg)", padding: 2, borderRadius: 6 }}>
                {[{ id: "sku", l: "Por SKU" }, { id: "categoria", l: "Por Categoria" }].map((m) => (
                  <button key={m.id} onClick={() => { setGestaoMode(m.id); setGestaoData(null); }} style={{ padding: "5px 14px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: gestaoMode === m.id ? "var(--accent)" : "transparent", color: gestaoMode === m.id ? "#000" : "var(--muted)", transition: "all .15s" }}>{m.l}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 2, background: "var(--bg)", padding: 2, borderRadius: 6 }}>
                {[{ id: "12m", l: "12 meses" }, { id: "24m", l: "24 meses" }, { id: "ano", l: "Ano atual" }].map((p) => (
                  <button key={p.id} onClick={() => setGestaoPeriodo(p.id)} style={{ padding: "5px 12px", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: gestaoPeriodo === p.id ? "var(--blue)" : "transparent", color: gestaoPeriodo === p.id ? "#fff" : "var(--muted)", transition: "all .15s" }}>{p.l}</button>
                ))}
              </div>
            </div>

            {/* Search input */}
            {gestaoMode === "sku" ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--dim)", pointerEvents: "none" }}>🔍</span>
                  <input
                    type="text"
                    value={gestaoSkuInput}
                    onChange={(e) => setGestaoSkuInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter" && gestaoSkuInput.trim()) { setGestaoSku(gestaoSkuInput.trim()); loadGestao("sku", gestaoSkuInput.trim()); } }}
                    placeholder="Digite o SKU e pressione Enter..."
                    style={{ width: "100%", padding: "10px 14px 10px 38px", fontSize: 14, background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, outline: "none", fontFamily: "var(--mono)", letterSpacing: 0.5, transition: "border-color .15s" }}
                    onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                  />
                </div>
                <button onClick={() => { if (gestaoSkuInput.trim()) { setGestaoSku(gestaoSkuInput.trim()); loadGestao("sku", gestaoSkuInput.trim()); } }} style={{ padding: "10px 22px", fontSize: 12, fontWeight: 700, background: "var(--accent)", color: "#000", border: "none", borderRadius: 8, cursor: "pointer" }}>Buscar</button>
              </div>
            ) : (
              <div style={{ marginBottom: 18 }}>
                <select
                  value={gestaoCatId}
                  onChange={(e) => { setGestaoCatId(e.target.value); if (e.target.value) loadGestao("categoria", e.target.value); }}
                  style={{ padding: "10px 14px", fontSize: 13, background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, outline: "none", minWidth: 300, cursor: "pointer" }}
                >
                  <option value="">Selecione uma categoria...</option>
                  {gestaoCategorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Loading */}
            {gestaoLoading && <Loader />}

            {/* No selection yet */}
            {!gestaoLoading && !gestaoData && (
              <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{gestaoMode === "sku" ? "📦" : "📂"}</div>
                <div style={{ fontSize: 14 }}>{gestaoMode === "sku" ? "Digite um SKU para ver a evolução" : "Selecione uma categoria para analisar"}</div>
              </div>
            )}

            {/* Results */}
            {!gestaoLoading && gestaoData && (<>
              {/* Summary card */}
              {gestaoData.resumo ? (
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
                  {gestaoMode === "sku" ? (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--accent)" }}>{gestaoData.resumo.sku}</span>
                        <span style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gestaoData.resumo.descricao || ""}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 10 }}>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Estoque</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)" }}>{fmt(gestaoData.resumo.estoque)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Preço Venda</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--green)" }}>{fmtR(gestaoData.resumo.preco)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Custo</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--red)" }}>{fmtR(gestaoData.resumo.precocusto)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Margem</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: Number(gestaoData.resumo.preco) > 0 ? "var(--accent)" : "var(--muted)" }}>
                            {Number(gestaoData.resumo.preco) > 0 ? fmtP((1 - Number(gestaoData.resumo.precocusto) / Number(gestaoData.resumo.preco)) * 100) : "–"}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", textTransform: "capitalize", marginBottom: 6 }}>{gestaoData.resumo.categoria}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 6 }}>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>SKUs na Categoria</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)" }}>{fmt(gestaoData.resumo.total_skus)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Estoque Total</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)" }}>{fmt(gestaoData.resumo.estoque_total)}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 24, marginBottom: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  {gestaoMode === "sku" ? `SKU "${gestaoSku}" não encontrado no estoque` : "Categoria não encontrada"}
                </div>
              )}

              {/* Charts */}
              {gestaoData.vendas_mes.length > 0 && (<>
                {(() => {
                  const mLabel = (m) => { const d = new Date(m + "T12:00:00"); const ml = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return `${ml[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; };
                  const normDate = (d) => typeof d === "string" ? d.substring(0, 10) : d; // normalize "2025-04-01T00:00:00" → "2025-04-01"
                  // Merge vendas + estoque by month
                  const estoqueMap = {};
                  (gestaoData.estoque_mes || []).forEach((e) => { estoqueMap[normDate(e.mes)] = Number(e.estoque); });
                  // Build detail maps (CPF/CNPJ) from post-nov data
                  const detMap = {}; // { mes: { cpf_un, cnpj_un, cpf_fat, cnpj_fat } }
                  (gestaoData.vendas_detalhe || []).forEach((d) => {
                    const k = normDate(d.mes);
                    if (!detMap[k]) detMap[k] = { cpf_un: 0, cnpj_un: 0, cpf_fat: 0, cnpj_fat: 0 };
                    if (d.tipo === "CPF") { detMap[k].cpf_un += Number(d.unidades) || 0; detMap[k].cpf_fat += Number(d.faturamento) || 0; }
                    else { detMap[k].cnpj_un += Number(d.unidades) || 0; detMap[k].cnpj_fat += Number(d.faturamento) || 0; }
                  });
                  const merged = gestaoData.vendas_mes.map((v) => {
                    const mk = normDate(v.mes);
                    const det = detMap[mk];
                    const estq = estoqueMap[mk];
                    const precoAtual = gestaoData.resumo?.precocusto ? Number(gestaoData.resumo.precocusto) : 0;
                    return {
                      mes: mk, mesLabel: mLabel(mk),
                      unidades: Number(v.unidades) || 0,
                      faturamento: Number(v.faturamento) || 0,
                      estoque: estq != null ? estq : null,
                      custo_estoque: estq != null && precoAtual > 0 ? Math.round(estq * precoAtual) : null,
                      // CPF/CNPJ split (only available post-nov)
                      cpf_un: det ? det.cpf_un : null, cnpj_un: det ? det.cnpj_un : null,
                      cpf_fat: det ? det.cpf_fat : null, cnpj_fat: det ? det.cnpj_fat : null,
                    };
                  });
                  // Add months that only have estoque but no sales
                  (gestaoData.estoque_mes || []).forEach((e) => {
                    const mk = normDate(e.mes);
                    if (!merged.find((m) => m.mes === mk)) {
                      const precoAtual = gestaoData.resumo?.precocusto ? Number(gestaoData.resumo.precocusto) : 0;
                      const estq = Number(e.estoque);
                      merged.push({ mes: mk, mesLabel: mLabel(mk), unidades: 0, faturamento: 0, estoque: estq, custo_estoque: precoAtual > 0 ? Math.round(estq * precoAtual) : null, cpf_un: null, cnpj_un: null, cpf_fat: null, cnpj_fat: null });
                    }
                  });
                  merged.sort((a, b) => a.mes.localeCompare(b.mes));
                  const hasDet = merged.some((m) => m.cpf_un != null);
                  const hasEstoque = merged.some((m) => m.estoque != null);

                  return (<>
                    {/* Row 1: Estoque vs Vendas (combined) + Custo Estoque vs Faturamento */}
                    <Sec icon="📈">Evolução Mensal</Sec>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {/* Estoque + Unidades Vendidas */}
                      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 6px 10px" }}>
                          <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Estoque vs Vendas</h3>
                          <div style={{ display: "flex", gap: 10 }}>
                            {hasEstoque && <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 3, borderRadius: 1, background: dark ? "#F59E0B" : "#D97706" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>Estoque</span></div>}
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: dark ? "#3B82F6" : "#2563EB" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>Vendas</span></div>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={merged}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="mesLabel" stroke="var(--dim)" fontSize={9} />
                            <YAxis yAxisId="l" stroke="var(--dim)" fontSize={9} />
                            {hasEstoque && <YAxis yAxisId="r" orientation="right" stroke={dark ? "#F59E0B" : "#D97706"} fontSize={9} />}
                            <Tooltip content={<ChartTT formatter={(v, n) => n === "Estoque" ? `${fmt(v)} un` : `${fmt(v)} un`} />} />
                            <Bar yAxisId="l" dataKey="unidades" name="Vendas" fill={dark ? "#3B82F6" : "#2563EB"} radius={[3, 3, 0, 0]} />
                            {hasEstoque && <Line yAxisId="r" type="monotone" dataKey="estoque" name="Estoque" stroke={dark ? "#F59E0B" : "#D97706"} dot={{ r: 3 }} strokeWidth={2} connectNulls />}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Custo Estoque vs Faturamento */}
                      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 6px 10px" }}>
                          <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Faturamento vs Custo Estoque</h3>
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: dark ? "#22C55E" : "#16A34A" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>Faturamento</span></div>
                            {hasEstoque && <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 3, borderRadius: 1, background: dark ? "#EF4444" : "#DC2626" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>Custo Estoque</span></div>}
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={merged}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="mesLabel" stroke="var(--dim)" fontSize={9} />
                            <YAxis yAxisId="l" stroke="var(--dim)" fontSize={9} tickFormatter={(v) => fmtR(v)} />
                            {hasEstoque && <YAxis yAxisId="r" orientation="right" stroke={dark ? "#EF4444" : "#DC2626"} fontSize={9} tickFormatter={(v) => fmtR(v)} />}
                            <Tooltip content={<ChartTT formatter={(v) => fmtR(v)} />} />
                            <Bar yAxisId="l" dataKey="faturamento" name="Faturamento" fill={dark ? "#22C55E" : "#16A34A"} radius={[3, 3, 0, 0]} />
                            {hasEstoque && <Line yAxisId="r" type="monotone" dataKey="custo_estoque" name="Custo Estoque" stroke={dark ? "#EF4444" : "#DC2626"} dot={{ r: 3 }} strokeWidth={2} connectNulls />}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Row 2: CPF/CNPJ split (only post-nov data) */}
                    {hasDet && (<>
                      <Sec icon="👥">Vendas CPF vs CNPJ (a partir de Nov/25)</Sec>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {/* Units by type */}
                        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 6px 10px" }}>
                            <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Unidades por Tipo</h3>
                            <div style={{ display: "flex", gap: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: dark ? "#3B82F6" : "#2563EB" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>CPF</span></div>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: dark ? "#F97316" : "#EA580C" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>CNPJ</span></div>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={merged.filter((m) => m.cpf_un != null)} stackOffset="none">
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                              <XAxis dataKey="mesLabel" stroke="var(--dim)" fontSize={9} />
                              <YAxis stroke="var(--dim)" fontSize={9} />
                              <Tooltip content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                                return (
                                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 11px", fontSize: 10, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>
                                    <div style={{ color: "var(--muted)", marginBottom: 4, fontWeight: 700 }}>{label}</div>
                                    <div style={{ fontWeight: 700, fontFamily: "var(--mono)", marginBottom: 4, fontSize: 12, color: "var(--text)" }}>Total: {fmt(total)}</div>
                                    {payload.map((p, i) => (
                                      <div key={i} style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 1 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.fill, flexShrink: 0 }} />
                                        <span style={{ color: "var(--muted)" }}>{p.name}:</span>
                                        <span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>{fmt(p.value)}</span>
                                        <span style={{ color: "var(--dim)", fontSize: 9 }}>({total > 0 ? ((p.value / total) * 100).toFixed(0) : 0}%)</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }} />
                              <Bar dataKey="cpf_un" name="CPF" stackId="a" fill={dark ? "#3B82F6" : "#2563EB"} radius={[0, 0, 0, 0]} />
                              <Bar dataKey="cnpj_un" name="CNPJ" stackId="a" fill={dark ? "#F97316" : "#EA580C"} radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Revenue by type */}
                        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 6px 10px" }}>
                            <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Faturamento por Tipo</h3>
                            <div style={{ display: "flex", gap: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: dark ? "#22C55E" : "#16A34A" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>CPF</span></div>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: dark ? "#A855F7" : "#7C3AED" }} /><span style={{ fontSize: 8, color: "var(--muted)" }}>CNPJ</span></div>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={merged.filter((m) => m.cpf_fat != null)} stackOffset="none">
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                              <XAxis dataKey="mesLabel" stroke="var(--dim)" fontSize={9} />
                              <YAxis stroke="var(--dim)" fontSize={9} tickFormatter={(v) => fmtR(v)} />
                              <Tooltip content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                                return (
                                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 11px", fontSize: 10, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>
                                    <div style={{ color: "var(--muted)", marginBottom: 4, fontWeight: 700 }}>{label}</div>
                                    <div style={{ fontWeight: 700, fontFamily: "var(--mono)", marginBottom: 4, fontSize: 12, color: "var(--text)" }}>Total: {fmtR(total)}</div>
                                    {payload.map((p, i) => (
                                      <div key={i} style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 1 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.fill, flexShrink: 0 }} />
                                        <span style={{ color: "var(--muted)" }}>{p.name}:</span>
                                        <span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>{fmtR(p.value)}</span>
                                        <span style={{ color: "var(--dim)", fontSize: 9 }}>({total > 0 ? ((p.value / total) * 100).toFixed(0) : 0}%)</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }} />
                              <Bar dataKey="cpf_fat" name="CPF" stackId="a" fill={dark ? "#22C55E" : "#16A34A"} radius={[0, 0, 0, 0]} />
                              <Bar dataKey="cnpj_fat" name="CNPJ" stackId="a" fill={dark ? "#A855F7" : "#7C3AED"} radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>)}
                  </>);
                })()}
              </>)}

              {/* No data message */}
              {gestaoData.vendas_mes.length === 0 && gestaoData.resumo && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Sem dados de vendas (NF) no período selecionado</div>
              )}

              {/* Top SKUs for category mode */}
              {gestaoMode === "categoria" && (gestaoData.top_skus || []).length > 0 && (<>
                <Sec icon="🏆">Top SKUs da Categoria</Sec>
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, padding: "0 0 8px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ width: 28, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>#</span>
                    <span style={{ width: 100, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>SKU</span>
                    <span style={{ flex: 1, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Descrição</span>
                    <span style={{ width: 70, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Unidades</span>
                    <span style={{ width: 90, fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Faturamento</span>
                  </div>
                  {gestaoData.top_skus.map((s, i) => (
                    <div key={s.sku} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: i < gestaoData.top_skus.length - 1 ? "1px solid var(--border)11" : "none", cursor: "pointer" }}
                      onClick={() => { setGestaoMode("sku"); setGestaoSkuInput(s.sku); setGestaoSku(s.sku); loadGestao("sku", s.sku); }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ width: 28, fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)", fontWeight: 600 }}>{i + 1}</span>
                      <span style={{ width: 100, fontSize: 12, fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent)" }}>{s.sku}</span>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.descricao}</span>
                      <span style={{ width: 70, fontSize: 13, fontFamily: "var(--mono)", fontWeight: 700, textAlign: "right" }}>{fmt(s.unidades)}</span>
                      <span style={{ width: 90, fontSize: 13, fontFamily: "var(--mono)", fontWeight: 600, textAlign: "right", color: "var(--green)" }}>{fmtR(s.faturamento)}</span>
                    </div>
                  ))}
                </div>
              </>)}
            </>)}
          </>)}

        <div style={{ textAlign: "center", padding: "28px 0 14px", fontSize: 9, color: "var(--dim)" }}>
          FullPro Dashboard • {section === "ml" ? `${dates.f} → ${dates.t} • ${contas.length === 4 ? "Todas as contas" : contas.map((c) => CONTA_LABELS[c]).join(", ")}` : `Gestão de Estoque • ${gestaoPeriodo === "12m" ? "Últimos 12 meses" : gestaoPeriodo === "24m" ? "Últimos 24 meses" : "Ano atual"}`}
        </div>
      </div>
    </div>
  );
}
