"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { fetchDashboard } from "@/lib/api";

const CONTAS_ALL = ["fullpro", "onroad", "darkstorm", "distribuidora"];
const CONTA_LABELS = { fullpro: "FullPro", onroad: "OnRoad", darkstorm: "DarkStorm", distribuidora: "Distrib." };
const ccHex = (c, dark) => {
  const d = { fullpro: "#F59E0B", onroad: "#3B82F6", darkstorm: "#A855F7", distribuidora: "#06B6D4" };
  const l = { fullpro: "#D97706", onroad: "#2563EB", darkstorm: "#7C3AED", distribuidora: "#0891B2" };
  return (dark ? d : l)[c] || "#6B7A8D";
};

const fmt = (n) => { if (n == null) return "\u2013"; const v = Number(n); if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`; return v.toLocaleString("pt-BR"); };
const fmtR = (n) => { if (n == null) return "\u2013"; const v = Number(n); if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`; if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}k`; return `R$ ${v.toLocaleString("pt-BR")}`; };
const fmtP = (n) => (n == null ? "\u2013" : `${Number(n).toFixed(1)}%`);
const ds = (d) => d.toISOString().split("T")[0];
const tickF = (v) => { const d = new Date(v + "T12:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; };

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

export default function Home() {
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState("vendas");
  const [chartView, setChartView] = useState("ads");
  const [contas, setContas] = useState([...CONTAS_ALL]);
  const [preset, setPreset] = useState("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDP, setShowDP] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [data, setData] = useState({ kpis: {}, vendas_dia: [], por_conta: [], top_estados: [], reclamacoes: [], pub_dia: [], pub_conta: [] });

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

  const selectPreset = (p) => { setPreset(p); setDateFrom(""); setDateTo(""); setShowDP(false); };
  const applyDates = () => { if (dateFrom && dateTo) { setPreset("custom"); setShowDP(false); } };

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const { f, t } = dates;
    const cw = contaW;
    const cw2 = contas.length < 4 ? `AND conta IN (${contas.map((c) => `'${c}'`).join(",")})` : "";
    try {
      const res = await fetchDashboard([
        { name: "kpis", sql: `SELECT count(*) as total_vendas, round(sum(receita_produtos)::numeric) as receita, round(avg(receita_produtos)::numeric) as ticket_medio, count(*) filter (where is_publicidade) as via_ads, round(100.0*count(*) filter (where is_publicidade)/nullif(count(*),0),1) as pct_ads, count(*) filter (where reclamacao is not null and reclamacao != 'Sem reclamacao') as reclamacoes, round(100.0*count(*) filter (where reclamacao is not null and reclamacao != 'Sem reclamacao')/nullif(count(*),0),1) as pct_reclamacao, count(*) filter (where status='cancelled') as canceladas, round(100.0*count(*) filter (where status='cancelled')/nullif(count(*),0),1) as pct_cancelada, round(sum(tarifa_venda+tarifa_envio)::numeric) as tarifas_total, round(sum(cancelamentos)::numeric) as valor_cancelamentos, round(sum(receita_envio)::numeric) as receita_frete FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw}` },
        { name: "vendas_dia", sql: `SELECT venda_data::date as dia, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita, count(*) filter (where is_publicidade) as via_ads, count(*) filter (where not is_publicidade) as organico, count(*) filter (where forma_envio='fulfillment') as fulfillment, count(*) filter (where forma_envio!='fulfillment' or forma_envio is null) as normal, count(*) filter (where listing_type='gold_pro') as premium, count(*) filter (where listing_type='gold_special') as classico FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY dia ORDER BY dia` },
        { name: "por_conta", sql: `SELECT conta, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita, round(avg(receita_produtos)::numeric) as ticket_medio, count(*) filter (where is_publicidade) as via_ads, count(*) filter (where reclamacao is not null and reclamacao != 'Sem reclamacao') as reclamacoes, round(sum(cancelamentos)::numeric) as valor_cancelamentos FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY conta ORDER BY receita DESC` },
        { name: "top_estados", sql: `SELECT coalesce(estado,'N/I') as estado, count(*) as vendas, round(sum(receita_produtos)::numeric) as receita FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} GROUP BY estado ORDER BY vendas DESC LIMIT 10` },
        { name: "reclamacoes", sql: `SELECT reclamacao, count(*) as total, round(sum(receita_produtos)::numeric) as receita_envolvida, round(sum(cancelamentos)::numeric) as valor_devolvido FROM ml_vendas WHERE venda_data::date>='${f}' AND venda_data::date<='${t}' ${cw} AND reclamacao IS NOT NULL AND reclamacao != 'Sem reclamacao' GROUP BY reclamacao ORDER BY total DESC LIMIT 10` },
        { name: "pub_dia", sql: `SELECT data as dia, round(sum(custo)::numeric) as custo, round(sum(total_amount)::numeric) as receita_ads, round((sum(custo)/nullif(sum(total_amount),0)*100)::numeric,1) as acos, round((sum(total_amount)/nullif(sum(custo),0))::numeric,1) as roas, sum(clicks) as clicks, sum(impressoes) as impressoes FROM ml_publicidade_diario WHERE data>='${f}' AND data<='${t}' ${cw2} GROUP BY data ORDER BY data` },
        { name: "pub_conta", sql: `SELECT conta, round(sum(custo)::numeric) as custo, round(sum(total_amount)::numeric) as receita_ads, round((sum(custo)/nullif(sum(total_amount),0)*100)::numeric,1) as acos, round((sum(total_amount)/nullif(sum(custo),0))::numeric,1) as roas, sum(clicks) as clicks, sum(impressoes) as impressoes, round(avg(cvr)::numeric,2) as cvr FROM ml_publicidade_diario WHERE data>='${f}' AND data<='${t}' ${cw2} GROUP BY conta ORDER BY custo DESC` },
      ]);
      setData({
        kpis: (res.kpis || [])[0] || {},
        vendas_dia: res.vendas_dia || [],
        por_conta: res.por_conta || [],
        top_estados: res.top_estados || [],
        reclamacoes: res.reclamacoes || [],
        pub_dia: res.pub_dia || [],
        pub_conta: res.pub_conta || [],
      });
    } catch (e) { console.error(e); setErr(e.message); }
    setLoading(false);
  }, [dates, contaW, contas]);

  useEffect(() => { load(); }, [load]);

  const k = data.kpis || {};
  const cvCfg = {
    ads: { k: ["via_ads", "organico"], n: ["Via Ads", "Org\u00e2nico"], c: [dark ? "#A855F7" : "#7C3AED", dark ? "#22C55E" : "#16A34A"] },
    envio: { k: ["fulfillment", "normal"], n: ["Fulfillment", "Normal"], c: [dark ? "#06B6D4" : "#0891B2", dark ? "#F97316" : "#EA580C"] },
    listing: { k: ["premium", "classico"], n: ["Premium", "Cl\u00e1ssico"], c: [dark ? "#F59E0B" : "#D97706", dark ? "#3B82F6" : "#2563EB"] },
  };
  const cv = cvCfg[chartView];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font)" }}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", background: "var(--card)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 8, color: "var(--accent)", fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" }}>FullPro</div>
          <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Dashboard ML</h1>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2, background: "var(--bg)", padding: 2, borderRadius: 6 }}>
            {["7d", "30d", "90d", "12m", "all"].map((p) => (
              <MTab key={p} on={preset === p} onClick={() => selectPreset(p)}>{p === "all" ? "Tudo" : p}</MTab>
            ))}
            <MTab on={preset === "custom" || showDP} onClick={() => setShowDP(!showDP)}>\ud83d\udcc5</MTab>
          </div>
          <button onClick={() => setDark((d) => !d)} style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {dark ? "\u2600\ufe0f" : "\ud83c\udf19"}
          </button>
        </div>
      </div>
      {showDP && (
        <div style={{ padding: "10px 22px", background: "var(--card)", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>De:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", fontSize: 12, colorScheme: dark ? "dark" : "light" }} />
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>At\u00e9:</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", fontSize: 12, colorScheme: dark ? "dark" : "light" }} />
          <button onClick={applyDates} style={{ padding: "5px 14px", fontSize: 11, fontWeight: 700, background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, cursor: "pointer" }}>Aplicar</button>
        </div>
      )}
      <div style={{ padding: "10px 22px", display: "flex", gap: 5, alignItems: "center", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginRight: 2 }}>Contas:</span>
        <Tag on={contas.length === 4} onClick={() => setContas([...CONTAS_ALL])}>Todas</Tag>
        {CONTAS_ALL.map((k) => (
          <Tag key={k} on={contas.includes(k)} onClick={() => toggleConta(k)} color={ccHex(k, dark)}>{CONTA_LABELS[k]}</Tag>
        ))}
        {loading && <span style={{ fontSize: 9, color: "var(--accent)", marginLeft: 8, fontWeight: 600 }}>\u23f3 Carregando...</span>}
      </div>
      <div style={{ padding: "18px 22px", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 2, marginBottom: 18, background: "var(--card)", padding: 3, borderRadius: 8, width: "fit-content", border: "1px solid var(--border)" }}>
          {[{ id: "vendas", l: "Vendas", i: "\ud83d\udce6" }, { id: "publicidade", l: "Publicidade", i: "\ud83d\udce2" }, { id: "problemas", l: "Reclama\u00e7\u00f5es", i: "\u26a0\ufe0f" }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 16px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6, background: tab === t.id ? "var(--accent)" : "transparent", color: tab === t.id ? "#000" : "var(--muted)", cursor: "pointer", display: "flex", gap: 4, alignItems: "center", transition: "all .15s" }}>
              <span style={{ fontSize: 12 }}>{t.i}</span>{t.l}
            </button>
          ))}
        </div>
        {err && <div style={{ padding: 12, background: "var(--red)22", border: "1px solid var(--red)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "var(--red)" }}>Erro: {err}</div>}
        {loading ? <Loader /> : (<>
          {tab === "vendas" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              <KPI label="Receita" value={fmtR(k.receita)} color="var(--green)" />
              <KPI label="Vendas" value={fmt(k.total_vendas)} color="var(--blue)" />
              <KPI label="Ticket M\u00e9dio" value={fmtR(k.ticket_medio)} color="var(--accent)" />
              <KPI label="Via Ads" value={fmtP(k.pct_ads)} sub={`${fmt(k.via_ads)} vendas`} color="var(--purple)" />
              <KPI label="Tarifas ML" value={fmtR(k.tarifas_total)} color="var(--red)" />
            </div>
            <Sec icon="\ud83d\udcca">Vendas por Dia</Sec>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 10px" }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 10, background: "var(--bg)", padding: 2, borderRadius: 5, width: "fit-content" }}>
                <MTab on={chartView === "ads"} onClick={() => setChartView("ads")}>Org\u00e2nico vs Ads</MTab>
                <MTab on={chartView === "envio"} onClick={() => setChartView("envio")}>Normal vs Fulfillment</MTab>
                <MTab on={chartView === "listing"} onClick={() => setChartView("listing")}>Cl\u00e1ssico vs Premium</MTab>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.vendas_dia} barCategoryGap="12%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" stroke="var(--dim)" fontSize={9} tickFormatter={tickF} interval={Math.max(0, Math.floor(data.vendas_dia.length / 15))} />
                  <YAxis stroke="var(--dim)" fontSize={9} />
                  <Tooltip content={<ChartTT formatter={(v) => fmt(v)} />} />
                  <Bar dataKey={cv.k[0]} name={cv.n[0]} stackId="a" fill={cv.c[0]} />
                  <Bar dataKey={cv.k[1]} name={cv.n[1]} stackId="a" fill={cv.c[1]} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
                <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>Top Estados</h3>
                {(data.top_estados || []).map((e, i) => {
                  const mx = (data.top_estados || [])[0]?.vendas || 1;
                  return (
                    <div key={e.estado} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 8, color: "var(--dim)", width: 12, textAlign: "right", fontFamily: "var(--mono)" }}>{i + 1}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.estado}</span>
                      <div style={{ flex: 1, height: 3, background: "var(--bg)", borderRadius: 2 }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${(e.vendas / mx) * 100}%`, background: "var(--accent)", transition: "width .5s" }} />
                      </div>
                      <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--muted)", minWidth: 35, textAlign: "right" }}>{fmt(e.vendas)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>)}
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
                  <KPI label="Clicks" value={fmt(t.clicks)} sub={`${fmt(t.imp)} impress\u00f5es`} color="var(--purple)" />
                </>);
              })()}
            </div>
            <Sec icon="\ud83d\udcb0">Custo vs Receita Ads</Sec>
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
            <Sec icon="\ud83d\udcc8">ACOS / ROAS</Sec>
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
            <Sec icon="\ud83c\udfea">Por Conta</Sec>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min((data.pub_conta || []).length || 1, 4)},1fr)`, gap: 10 }}>
              {(data.pub_conta || []).map((c) => (
                <div key={c.conta} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${ccHex(c.conta, dark)}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{CONTA_LABELS[c.conta] || c.conta}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {[{ l: "Custo", v: fmtR(c.custo), cl: "var(--red)" }, { l: "Receita", v: fmtR(c.receita_ads), cl: "var(--green)" }, { l: "ACOS", v: fmtP(c.acos), cl: "var(--text)" }, { l: "ROAS", v: c.roas ? `${c.roas}x` : "\u2013", cl: "var(--text)" }].map((m, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 7, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>{m.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: m.cl }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>)}
          {tab === "problemas" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              <KPI label="Reclama\u00e7\u00f5es" value={fmt(k.reclamacoes)} sub={`${fmtP(k.pct_reclamacao)} das vendas`} color="var(--red)" />
              <KPI label="Cancelamentos" value={fmt(k.canceladas)} sub={`${fmtP(k.pct_cancelada)} das vendas`} color="var(--orange)" />
              <KPI label="Valor Devolvido" value={fmtR(k.valor_cancelamentos)} sub="cancelamentos" color="var(--red)" />
              <KPI label="Frete Recebido" value={fmtR(k.receita_frete)} color="var(--cyan)" />
              <KPI label="Vendas OK" value={fmt((k.total_vendas || 0) - (k.canceladas || 0))} color="var(--green)" />
            </div>
            <Sec icon="\ud83d\udccb">Tipos de Reclama\u00e7\u00e3o</Sec>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, padding: "0 0 7px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ flex: 1, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Tipo</span>
                <span style={{ width: 55, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>Qtd</span>
                <span style={{ width: 85, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>Receita Env.</span>
                <span style={{ width: 85, fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>Devolvido</span>
              </div>
              {(data.reclamacoes || []).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "5px 0", borderBottom: i < (data.reclamacoes || []).length - 1 ? "1px solid var(--border)22" : "none" }}>
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
                <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Nenhuma reclama\u00e7\u00e3o no per\u00edodo \ud83c\udf89</div>
              )}
            </div>
            <Sec icon="\ud83c\udfea">Por Conta</Sec>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min((data.por_conta || []).length || 1, 4)},1fr)`, gap: 10 }}>
              {(data.por_conta || []).map((c) => (
                <div key={c.conta} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${ccHex(c.conta, dark)}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7 }}>{CONTA_LABELS[c.conta] || c.conta}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {[{ l: "Reclama\u00e7\u00f5es", v: fmt(c.reclamacoes), cl: "var(--red)" }, { l: "% Vendas", v: c.vendas > 0 ? fmtP((c.reclamacoes / c.vendas) * 100) : "\u2013", cl: "var(--text)" }, { l: "Vendas", v: fmt(c.vendas), cl: "var(--muted)" }, { l: "Devolvido", v: fmtR(c.valor_cancelamentos), cl: "var(--red)" }].map((m, i) => (
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
        <div style={{ textAlign: "center", padding: "28px 0 14px", fontSize: 9, color: "var(--dim)" }}>
          FullPro Dashboard \u2022 {dates.f} \u2192 {dates.t} \u2022 {contas.length === 4 ? "Todas as contas" : contas.map((c) => CONTA_LABELS[c]).join(", ")}
        </div>
      </div>
    </div>
  );
}
