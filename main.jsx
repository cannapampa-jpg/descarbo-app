import React, { useState, useMemo } from "react";

// ============================================================
//  DESCARBOXILADORA — v6 (lista para lanzar al llegar datos finales)
//  - Cinetica basada en Wang et al. 2016 (flor / extracto)
//  - CBN fuera del cuadro; semaforo + umbral zona caliente (>140 C)
//  - Cambios de interfaz aplicados (ver notas)
//
//  >>> UNICO LUGAR A EDITAR CUANDO LLEGUEN LOS DATOS FINALES <<<
//  Ver bloque CINETICA. Cambiar Ea (J/mol) y A (1/s) por cannabinoide
//  y por material. El resto de la app no se toca.
// ============================================================

const UI = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";

const C = {
  paper: "#E9ECE4",
  surface: "#FBFCF9",
  ink: "#20261E",
  inkSoft: "#5B6455",
  line: "#D2D7C9",
  green: "#1F3D2B",
  greenMid: "#3E6B4A",
  greenSoft: "#DCE7DA",
  greenBand: "#4FA06A",
  amber: "#B87721",
  red: "#A5382C",
  muted: "#C4CBBB",
};

const R = 8.314;

// ============================================================
//  >>> CINETICA — EDITAR ACA CUANDO LLEGUEN LOS DATOS FINALES <<<
//  Valores actuales: derivados de Wang et al. 2016 (provisorios,
//  pendientes de calibracion final flor/extracto).
//  Ea en J/mol ; A (factor de frecuencia) en 1/s.
//  factor = correccion de masa por perdida de CO2.
// ============================================================
const CINETICA = {
  flor: {
    // Calibrado a tiempos reales de flor (~33 min THCA a 120 C, 97%).
    THCA: { Ea: 88000, A: 8.7e8, to: "THC", factor: 0.877 },
    CBDA: { Ea: 96000, A: 3.8e9, to: "CBD", factor: 0.878 },
  },
  extracto: {
    // aproximacion: descarboxila mas rapido que la flor (~2x)
    THCA: { Ea: 88000, A: 1.74e9, to: "THC", factor: 0.877 },
    CBDA: { Ea: 96000, A: 7.6e9, to: "CBD", factor: 0.878 },
  },
};

// Umbrales de degradacion a CBN (zona caliente). Se activan solo si
// el rango de temperatura supera estos valores (hoy el rango es 110-130).
const CBN_UMBRAL_MODERADO = 135;
const CBN_UMBRAL_ALTO = 145;

const RANGO = [110, 115, 120, 125, 130];
const ESTANDAR = 120;

// slider objetivo
const OBJ_MIN = 80;
const OBJ_MAX = 99;
const REC_MIN = 95; // banda verde recomendada
const REC_MAX = 98;

const kAt = (p, tempC) => p.A * Math.exp(-p.Ea / (R * (tempC + 273.15)));
const num = (v) => (v === "" || isNaN(parseFloat(v)) ? 0 : parseFloat(v));

function fmt(n, d = 1) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtTiempo(min) {
  if (!isFinite(min) || min <= 0) return "—";
  if (min < 90) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

// semaforo CBN segun temperatura
function cbnEstado(tempC) {
  if (tempC <= CBN_UMBRAL_MODERADO) return { label: "Despreciable", color: C.greenBand };
  if (tempC <= CBN_UMBRAL_ALTO) return { label: "Moderada", color: C.amber };
  return { label: "Alta", color: C.red };
}

function calcInverso(material, cannabinoide, objetivoPct) {
  const p = CINETICA[material][cannabinoide];
  const f = objetivoPct / 100;
  const filas = RANGO.map((tempC) => {
    const k = kAt(p, tempC);           // 1/s (Wang 2016)
    const tSeg = -Math.log(1 - f) / k; // resultado en SEGUNDOS
    const tMin = tSeg / 60;            // a minutos
    return { tempC, tMin, cbn: cbnEstado(tempC) };
  });
  const estandar = filas.find((r) => r.tempC === ESTANDAR) || filas[Math.floor(filas.length / 2)];
  return { filas, estandar };
}

// concentracion final en mg/g (independiente de la cantidad)
function calcConc(material, cannabinoide, objetivoPct, acidoMgG, previoMgG) {
  const acido = num(acidoMgG);
  if (!(acido > 0)) return null;
  const p = CINETICA[material][cannabinoide];
  const generado = acido * (objetivoPct / 100) * p.factor;
  const acidoRem = acido * (1 - objetivoPct / 100);
  const previo = num(previoMgG);
  return {
    final: generado + previo,
    generado,
    previo,
    acidoRem,
    nombreActivo: p.to,
  };
}

function InputMini({ label, unit, value, onChange, step = 1 }) {
  return (
    <div style={{ borderColor: C.line }} className="rounded-lg border bg-white px-3 py-2">
      <div className="mb-0.5 flex items-baseline justify-between">
        <span style={{ color: C.inkSoft }} className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
        <span style={{ color: C.muted, fontFamily: MONO }} className="text-[10px]">{unit}</span>
      </div>
      <input
        type="number" inputMode="decimal" value={value} step={step} min={0}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        style={{ color: C.ink, fontFamily: MONO }}
        className="w-full bg-transparent text-xl font-semibold outline-none"
      />
    </div>
  );
}

function Toggle({ opciones, valor, onChange, render }) {
  return (
    <div className="flex gap-2">
      {opciones.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            background: valor === o ? C.greenMid : "transparent",
            color: valor === o ? "#fff" : C.inkSoft,
            borderColor: C.line,
          }}
          className="flex-1 rounded-lg border py-2.5 text-sm font-semibold"
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

export default function DecarbApp() {
  const [material, setMaterial] = useState("flor");
  const [cann, setCann] = useState("THCA");
  const [objetivo, setObjetivo] = useState(97);
  const [concOpen, setConcOpen] = useState(true);
  const [acido, setAcido] = useState("");
  const [previo, setPrevio] = useState("");

  const to = CINETICA[material][cann].to;
  const { filas, estandar } = useMemo(
    () => calcInverso(material, cann, objetivo),
    [material, cann, objetivo]
  );
  const conc = useMemo(
    () => calcConc(material, cann, objetivo, acido, previo),
    [material, cann, objetivo, acido, previo]
  );

  // posiciones de la banda recomendada sobre el slider
  const bandLeft = ((REC_MIN - OBJ_MIN) / (OBJ_MAX - OBJ_MIN)) * 100;
  const bandWidth = ((REC_MAX - REC_MIN) / (OBJ_MAX - OBJ_MIN)) * 100;

  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: UI, minHeight: "100vh" }} className="w-full">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');`}</style>

      <div className="mx-auto max-w-md px-4 pb-16 pt-6">
        {/* header */}
        <div className="mb-5">
          <div style={{ color: C.greenMid, fontFamily: MONO }} className="mb-1 text-[11px] font-medium uppercase tracking-widest">
            Cannabinoides · cinética térmica
          </div>
          <h1 style={{ color: C.green }} className="text-3xl font-bold leading-none">Descarboxiladora</h1>
          <p style={{ color: C.inkSoft }} className="mt-1.5 text-sm">Elegí cuánto querés descarboxilar y te da la temperatura y el tiempo.</p>
        </div>

        {/* material + cannabinoide + objetivo */}
        <div style={{ background: C.surface, borderColor: C.line }} className="mb-4 rounded-xl border p-4">
          <div style={{ color: C.inkSoft }} className="mb-2 text-xs font-medium uppercase tracking-wide">Material</div>
          <div className="mb-4">
            <Toggle
              opciones={["flor", "extracto"]}
              valor={material}
              onChange={setMaterial}
              render={(o) => (o === "flor" ? "Flor" : "Extracto")}
            />
            <div style={{ color: C.muted }} className="mt-1 text-[10px]">Extracto (alcohólico u oleoso): descarboxila más rápido. Modelo aproximado para extractos.</div>
          </div>

          <div style={{ color: C.inkSoft }} className="mb-2 text-xs font-medium uppercase tracking-wide">Cannabinoide</div>
          <div className="mb-4">
            <Toggle
              opciones={["THCA", "CBDA"]}
              valor={cann}
              onChange={setCann}
              render={(o) => `${o} → ${CINETICA[material][o].to}`}
            />
          </div>

          <div className="mb-1.5 flex items-baseline justify-between">
            <span style={{ color: C.inkSoft }} className="text-xs font-medium uppercase tracking-wide">Objetivo de descarboxilación</span>
            <span style={{ color: C.green, fontFamily: MONO }} className="text-2xl font-bold">{objetivo}<span className="ml-0.5 text-sm" style={{ color: C.muted }}>%</span></span>
          </div>
          <input
            type="range" min={OBJ_MIN} max={OBJ_MAX} step={1} value={objetivo}
            onChange={(e) => setObjetivo(parseFloat(e.target.value))}
            className="w-full" style={{ accentColor: C.green }}
          />
          {/* banda verde recomendada */}
          <div style={{ position: "relative", height: 22 }} className="mt-1">
            <div style={{ position: "absolute", top: 0, height: 7, left: 0, right: 0, background: C.paper, borderRadius: 4 }} />
            <div style={{ position: "absolute", top: 0, height: 7, left: `${bandLeft}%`, width: `${bandWidth}%`, background: C.greenBand, borderRadius: 4 }} />
            <div style={{ position: "absolute", top: 10, left: `${bandLeft}%`, color: C.greenMid, fontFamily: MONO }} className="text-[9px] font-medium whitespace-nowrap">recomendado 95–98%</div>
          </div>
        </div>

        {/* estandar recomendado — temp y tiempo mismo peso */}
        <div style={{ background: C.green }} className="mb-3 rounded-2xl p-4 text-white">
          <div style={{ fontFamily: MONO }} className="mb-3 text-[11px] uppercase tracking-widest opacity-70">Condición recomendada</div>
          <div className="flex items-stretch gap-3">
            <div className="flex-1 rounded-xl bg-white/10 px-3 py-3 text-center">
              <div style={{ fontFamily: MONO }} className="text-3xl font-bold leading-none">{estandar.tempC}°C</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide opacity-70">temperatura</div>
            </div>
            <div className="flex-1 rounded-xl bg-white/10 px-3 py-3 text-center">
              <div style={{ fontFamily: MONO }} className="text-3xl font-bold leading-none">{Math.round(estandar.tMin)}<span className="text-lg"> min</span></div>
              <div className="mt-1 text-[10px] uppercase tracking-wide opacity-70">tiempo</div>
            </div>
          </div>
          {/* semaforo CBN */}
          <div className="mt-3 flex items-center gap-2">
            <span style={{ width: 9, height: 9, borderRadius: 999, background: estandar.cbn.color, display: "inline-block" }} />
            <span className="text-xs opacity-90">Degradación a CBN: <strong>{estandar.cbn.label.toLowerCase()}</strong></span>
          </div>
        </div>

        {/* tabla de alternativas */}
        <div style={{ background: C.surface, borderColor: C.line }} className="overflow-hidden rounded-xl border">
          <div style={{ background: C.greenSoft, color: C.green, fontFamily: MONO }} className="grid grid-cols-2 px-3 py-2 text-[11px] font-bold uppercase">
            <span>Temperatura</span>
            <span className="text-right">Tiempo</span>
          </div>
          {filas.map((r, i) => {
            const esEstandar = r.tempC === estandar.tempC;
            return (
              <div
                key={i}
                style={{
                  fontFamily: MONO,
                  background: esEstandar ? C.greenSoft : "transparent",
                  borderColor: C.line,
                  color: C.ink,
                }}
                className="grid grid-cols-2 border-t px-3 py-2.5 text-sm"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  {esEstandar && <span style={{ color: C.greenMid }}>✓</span>}
                  {r.tempC}°C
                </span>
                <span className="text-right">{fmtTiempo(r.tMin)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ color: C.inkSoft }} className="mt-3 flex items-start gap-2 text-[11px] leading-snug">
          <span style={{ width: 9, height: 9, borderRadius: 999, background: C.greenBand, display: "inline-block", marginTop: 3, flexShrink: 0 }} />
          <span>Todo el rango está en zona segura: la degradación a CBN empieza a ser relevante recién arriba de ~140&nbsp;°C. Menos temperatura pide más tiempo.</span>
        </div>

        {/* concentracion final — plegable */}
        <div style={{ background: C.surface, borderColor: C.line }} className="mt-5 rounded-xl border">
          <button
            onClick={() => setConcOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span style={{ color: C.green }} className="text-sm font-semibold">Calcular concentración final</span>
            <span style={{ color: C.greenMid, fontFamily: MONO }} className="text-lg leading-none">{concOpen ? "–" : "+"}</span>
          </button>

          {concOpen && (
            <div className="px-4 pb-4">
              <p style={{ color: C.inkSoft }} className="mb-3 text-[11px] leading-snug">
                Cargá los mg/g del cromatograma y te da el {to} final en mg/g, listo para el formulador.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <InputMini label={cann} unit="mg/g" value={acido} onChange={setAcido} step={1} />
                <InputMini label={`${to} previo`} unit="mg/g" value={previo} onChange={setPrevio} step={1} />
              </div>

              {conc && (
                <div style={{ borderColor: C.line }} className="mt-3 divide-y rounded-lg border">
                  <div className="flex items-center justify-between px-3 py-3" style={{ background: C.greenSoft }}>
                    <span style={{ color: C.green }} className="text-sm font-semibold">{conc.nombreActivo} final</span>
                    <span style={{ color: C.green, fontFamily: MONO }} className="text-2xl font-bold">{fmt(conc.final)}<span className="ml-1 text-xs font-medium" style={{ color: C.greenMid }}>mg/g</span></span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderColor: C.line }}>
                    <span style={{ color: C.inkSoft }} className="text-xs font-medium">· generado al descarboxilar</span>
                    <span style={{ color: C.inkSoft, fontFamily: MONO }} className="text-sm">{fmt(conc.generado)} mg/g</span>
                  </div>
                  {conc.previo > 0 && (
                    <div className="flex items-center justify-between px-3 py-2" style={{ borderColor: C.line }}>
                      <span style={{ color: C.inkSoft }} className="text-xs font-medium">· ya presente en el material</span>
                      <span style={{ color: C.inkSoft, fontFamily: MONO }} className="text-sm">{fmt(conc.previo)} mg/g</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderColor: C.line }}>
                    <span style={{ color: C.inkSoft }} className="text-xs font-medium">{cann} sin convertir</span>
                    <span style={{ color: C.inkSoft, fontFamily: MONO }} className="text-sm">{fmt(conc.acidoRem)} mg/g</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* pie: cita + deslinde */}
        <div className="mt-8 space-y-2">
          <p style={{ color: C.inkSoft }} className="text-center text-[10px] leading-snug">
            Wang, M. et al. (2016). <span className="italic">Decarboxylation Study of Acidic Cannabinoids</span>. Cannabis and Cannabinoid Research, 1(1), 262–271.
          </p>
          <div style={{ borderColor: C.line }} className="border-t pt-2">
            <p style={{ color: C.inkSoft }} className="text-[10px] leading-snug">
              Modelo basado en bibliografía científica (cinética de primer orden, ecuación de Arrhenius y factores másicos). Los resultados son orientativos y dependen de los datos ingresados. No reemplazan el control analítico ni el criterio profesional. El uso de derivados de cannabis debe ajustarse a la normativa vigente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
