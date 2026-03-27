"use client";
import { useState } from "react";

const UF = {
  "Acre":"AC","Alagoas":"AL","Amapá":"AP","Amazonas":"AM","Bahia":"BA","Ceará":"CE",
  "Distrito Federal":"DF","Espírito Santo":"ES","Goiás":"GO","Maranhão":"MA","Mato Grosso":"MT",
  "Mato Grosso do Sul":"MS","Minas Gerais":"MG","Pará":"PA","Paraíba":"PB","Paraná":"PR",
  "Pernambuco":"PE","Piauí":"PI","Rio de Janeiro":"RJ","Rio Grande do Norte":"RN",
  "Rio Grande do Sul":"RS","Rondônia":"RO","Roraima":"RR","Santa Catarina":"SC",
  "São Paulo":"SP","Sergipe":"SE","Tocantins":"TO"
};

const PATHS = {
  AM: "M42,160 L42,118 L68,98 L130,82 L180,92 L225,82 L238,98 L238,190 L218,220 L200,248 L155,268 L118,268 L82,258 L42,255Z",
  RR: "M130,82 L155,28 L195,18 L215,42 L210,72 L180,92Z",
  AP: "M268,42 L248,78 L258,118 L288,128 L302,98 L298,58 L278,42Z",
  PA: "M238,98 L248,78 L258,118 L288,128 L328,128 L348,188 L328,248 L258,258 L218,258 L218,220 L238,190Z",
  MA: "M348,148 L328,148 L328,248 L358,258 L388,238 L395,198 L378,168Z",
  TO: "M298,258 L288,348 L318,368 L338,348 L338,258Z",
  PI: "M378,168 L395,198 L398,258 L408,268 L418,228 L408,188 L398,168Z",
  CE: "M418,158 L408,188 L418,228 L448,218 L458,188 L448,168Z",
  RN: "M458,178 L448,198 L468,208 L478,188Z",
  PB: "M448,218 L448,228 L478,222 L478,208 L468,208Z",
  PE: "M398,238 L408,268 L478,238 L478,228 L448,228Z",
  AL: "M450,268 L442,278 L465,278 L472,258 L462,248Z",
  SE: "M438,282 L432,298 L452,292 L455,278 L442,278Z",
  BA: "M338,258 L318,368 L328,388 L358,418 L408,418 L438,368 L448,308 L448,268 L408,268 L398,258 L358,258Z",
  MT: "M118,268 L155,268 L200,248 L218,258 L258,258 L298,258 L288,348 L258,398 L178,398 L118,358Z",
  GO: "M258,398 L288,348 L318,368 L328,388 L358,418 L338,438 L298,438 L268,428Z",
  DF: "M328,395 L318,408 L332,412 L338,400Z",
  MS: "M178,398 L178,468 L238,478 L268,458 L268,428 L258,398Z",
  MG: "M338,438 L358,418 L408,418 L438,368 L448,348 L448,418 L428,448 L388,458 L348,458Z",
  ES: "M448,368 L448,418 L468,412 L472,378Z",
  RJ: "M388,458 L428,448 L438,468 L412,478 L388,468Z",
  SP: "M268,458 L268,498 L358,498 L388,468 L388,458 L348,458 L338,438 L298,438Z",
  PR: "M238,498 L238,530 L328,530 L348,510 L358,498 L268,498Z",
  SC: "M278,530 L278,558 L342,548 L338,530Z",
  RS: "M248,548 L228,598 L298,608 L325,565 L305,548 L278,558Z",
  RO: "M42,255 L82,258 L118,268 L118,358 L82,348 L42,328Z",
};

const fmtN = (n) => { if (n == null) return "\u2013"; const v = Number(n); if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v/1e3).toFixed(1)}k`; return v.toLocaleString("pt-BR"); };
const fmtR = (n) => { if (n == null) return "\u2013"; const v = Number(n); if (v >= 1e6) return `R$ ${(v/1e6).toFixed(2)}M`; if (v >= 1e3) return `R$ ${(v/1e3).toFixed(1)}k`; return `R$ ${v.toLocaleString("pt-BR")}`; };

function centroid(d) {
  const nums = d.match(/[\d.]+/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length };
}

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
    if (dark) {
      const r = Math.round(20 + t * 39);
      const g = Math.round(30 + t * 100);
      const b = Math.round(50 + t * 196);
      return `rgb(${r},${g},${b})`;
    } else {
      const r = Math.round(219 - t * 182);
      const g = Math.round(234 - t * 151);
      const b = Math.round(254 - t * 3);
      return `rgb(${r},${g},${b})`;
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="20 0 480 630" style={{ width: "100%", height: "auto", maxHeight: 320 }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}>
        {Object.entries(PATHS).map(([uf, d]) => (
          <path key={uf} d={d} fill={getColor(uf)}
            stroke={hover === uf ? (dark ? "#fff" : "#000") : (dark ? "#2a2d35" : "#d1d5db")}
            strokeWidth={hover === uf ? 2 : 0.8}
            style={{ cursor: "pointer", transition: "fill .2s, stroke .15s" }}
            onMouseEnter={() => setHover(uf)}
            onMouseLeave={() => setHover(null)} />
        ))}
        {Object.entries(PATHS).map(([uf, d]) => {
          const c = centroid(d);
          const small = ["DF","SE","AL","RN","PB"].includes(uf);
          return <text key={`t-${uf}`} x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central"
            fontSize={small ? 8 : 11} fontWeight={600} fill={dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"}
            style={{ pointerEvents: "none", fontFamily: "var(--mono)" }}>{uf}</text>;
        })}
      </svg>
      {hover && lookup[hover] && (
        <div style={{
          position: "absolute", left: Math.min(mouse.x + 12, 180), top: Math.max(mouse.y - 55, 0),
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "8px 12px", fontSize: 10, boxShadow: "0 4px 16px rgba(0,0,0,.35)",
          pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap"
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{lookup[hover].estado} ({hover})</div>
          <div><span style={{ color: "var(--muted)" }}>Vendas: </span><span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>{fmtN(lookup[hover].vendas)}</span></div>
          <div><span style={{ color: "var(--muted)" }}>Receita: </span><span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>{fmtR(lookup[hover].receita)}</span></div>
        </div>
      )}
    </div>
  );
}
