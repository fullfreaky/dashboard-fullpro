"use client";
import { useState } from "react";
import { PATHS, LABELS } from "./brazil-paths";

const UF = {"Acre":"AC","Alagoas":"AL","Amap\u00e1":"AP","Amazonas":"AM","Bahia":"BA","Cear\u00e1":"CE","Distrito Federal":"DF","Esp\u00edrito Santo":"ES","Goi\u00e1s":"GO","Maranh\u00e3o":"MA","Mato Grosso":"MT","Mato Grosso do Sul":"MS","Minas Gerais":"MG","Par\u00e1":"PA","Para\u00edba":"PB","Paran\u00e1":"PR","Pernambuco":"PE","Piau\u00ed":"PI","Rio de Janeiro":"RJ","Rio Grande do Norte":"RN","Rio Grande do Sul":"RS","Rond\u00f4nia":"RO","Roraima":"RR","Santa Catarina":"SC","S\u00e3o Paulo":"SP","Sergipe":"SE","Tocantins":"TO"};

const fmtN = (n) => { if (n == null) return "\u2013"; const v = Number(n); if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v/1e3).toFixed(1)}k`; return v.toLocaleString("pt-BR"); };
const fmtR = (n) => { if (n == null) return "\u2013"; const v = Number(n); if (v >= 1e6) return `R$ ${(v/1e6).toFixed(2)}M`; if (v >= 1e3) return `R$ ${(v/1e3).toFixed(1)}k`; return `R$ ${v.toLocaleString("pt-BR")}`; };

export default function BrazilMap({ estados = [], dark = true }) {
  const [hover, setHover] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const lookup = {};
  let maxV = 1;
  estados.forEach((e) => {
    const uf = UF[e.estado];
    if (uf) { lookup[uf] = e; if (Number(e.vendas) > maxV) maxV = Number(e.vendas); }
  });
  const getColor = (uf) => {
    const d = lookup[uf];
    if (!d) return dark ? "#1a1d23" : "#e5e7eb";
    const t = Math.pow(Number(d.vendas) / maxV, 0.5);
    if (dark) return `rgb(${Math.round(20+t*39)},${Math.round(30+t*100)},${Math.round(50+t*196)})`;
    return `rgb(${Math.round(219-t*182)},${Math.round(234-t*151)},${Math.round(254-t*3)})`;
  };
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 613 639" style={{ width: "100%", height: "auto", maxHeight: 340 }}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMouse({ x: e.clientX - r.left, y: e.clientY - r.top }); }}>
        {Object.entries(PATHS).map(([uf, d]) => (
          <path key={uf} d={d} fill={getColor(uf)}
            stroke={hover === uf ? (dark ? "#fff" : "#000") : (dark ? "#2a2d35" : "#d1d5db")}
            strokeWidth={hover === uf ? 1.5 : 0.5}
            style={{ cursor: "pointer", transition: "fill .2s, stroke .15s" }}
            onMouseEnter={() => setHover(uf)} onMouseLeave={() => setHover(null)} />
        ))}
        {Object.entries(LABELS).map(([uf, p]) => (
          <text key={`t-${uf}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
            fontSize={["DF","SE","AL","RN","PB","ES","RJ","SC"].includes(uf) ? 7 : 9} fontWeight={600}
            fill={dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
            style={{ pointerEvents: "none", fontFamily: "var(--mono)" }}>{uf}</text>
        ))}
      </svg>
      {hover && lookup[hover] && (
        <div style={{ position: "absolute", left: Math.min(mouse.x+12, 200), top: Math.max(mouse.y-55, 0),
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "8px 12px", fontSize: 10, boxShadow: "0 4px 16px rgba(0,0,0,.35)",
          pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{lookup[hover].estado} ({hover})</div>
          <div><span style={{ color: "var(--muted)" }}>Vendas: </span><span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>{fmtN(lookup[hover].vendas)}</span></div>
          <div><span style={{ color: "var(--muted)" }}>Receita: </span><span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>{fmtR(lookup[hover].receita)}</span></div>
        </div>
      )}
    </div>
  );
}
