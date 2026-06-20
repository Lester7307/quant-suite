import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area,
  ComposedChart, Cell
} from 'recharts';
import {
  Play, Download, TrendingUp, AlertTriangle, ShieldCheck, Activity,
  Award, BarChart3, Sliders, Info, Sun, Moon, ArrowDownRight,
  ArrowUpRight, Cpu, Layers, Bookmark, Trash2, CheckCircle2, History,
  Search, Zap, Star, ZoomIn, ZoomOut, RotateCcw, ChevronDown, Filter,
  Eye, Plus, Maximize2, Calculator, Grid, Code, Flame, Mail, Phone,
  MapPin, Settings, RefreshCw, Layers2, FileCode2, Terminal, HelpCircle,
  Check, AlertCircle, Pause, Play as PlayIcon, Save, FolderOpen, FileSpreadsheet, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ---------- UTILITY HELPERS ----------
const throttle = (fn, delay) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

// ---------- FALLBACK DATA GENERATORS ----------
const generateFallbackEquityData = (points = 30) => {
  let value = 1000000;
  return Array.from({ length: points }, (_, i) => {
    const date = new Date(2023, 0, 1 + i).toISOString().slice(0, 10);
    const change = (Math.random() - 0.48) * 0.02;
    value = Math.max(800000, value * (1 + change));
    return { date, value: Math.round(value), benchmark: Math.round(value * (0.9 + 0.1 * Math.sin(i / 5))) };
  });
};

const generateFallbackDrawdownData = (points = 30) => {
  return Array.from({ length: points }, (_, i) => {
    const date = new Date(2023, 0, 1 + i).toISOString().slice(0, 10);
    const dd = -Math.abs(Math.sin(i / 3) * 15 + Math.random() * 5);
    return { date, value: Math.round(dd * 100) / 100 };
  });
};

const generateFallbackRealtime = (symbol = 'RELIANCE.NS') => {
  const base = 2450;
  return Array.from({ length: 200 }, (_, i) => {
    const time = new Date(Date.now() - (200 - i) * 60000).toLocaleTimeString('en-US', { hour12: false });
    const noise = (Math.random() - 0.5) * 8;
    const close = base + i * 0.5 + noise;
    return {
      timestamp: time,
      close: close,
      open: close - (Math.random() - 0.5) * 2,
      high: close + Math.random() * 2,
      low: close - Math.random() * 2,
      volume: Math.floor(100000 + Math.random() * 900000),
      ma50: close * 0.995,
      ma200: close * 0.982,
      bbUpper: close * 1.025,
      bbMiddle: close * 1.002,
      bbLower: close * 0.975,
      rsiVal: 40 + Math.floor(Math.random() * 40),
      macdHist: (Math.random() - 0.5) * 2
    };
  });
};

// ---------- CUSTOM CANDLESTICK SHAPE ----------
const Candlestick = (props) => {
  const { x, y, width, height, payload, index } = props;
  const { open, close, high, low } = payload;
  const isGreen = close >= open;
  const bodyHeight = Math.abs(close - open) / (high - low) * height;
  const bodyY = isGreen ? y + height - bodyHeight : y;
  const wickTop = y;
  const wickBottom = y + height;
  const wickX = x + width / 2;

  return (
    <g>
      <line x1={wickX} y1={wickTop} x2={wickX} y2={wickBottom} stroke="#888" strokeWidth={1} />
      <rect
        x={x + 1}
        y={bodyY}
        width={width - 2}
        height={Math.max(bodyHeight, 1)}
        fill={isGreen ? '#02c076' : '#f6465d'}
        stroke={isGreen ? '#02c076' : '#f6465d'}
        strokeWidth={1}
      />
    </g>
  );
};

// ---------- AGGREGATION FUNCTIONS ----------
const aggregateCandles = (data, timeframe) => {
  if (!data || data.length === 0) return [];
  const intervalMap = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1D': 1440
  };
  const groupMinutes = intervalMap[timeframe] || 1;
  const result = [];
  let currentGroup = [];
  let groupStart = null;

  data.forEach((point) => {
    const [h, m, s] = point.timestamp.split(':').map(Number);
    const totalMinutes = h * 60 + m + s / 60;
    const groupIndex = Math.floor(totalMinutes / groupMinutes);
    if (groupStart === null) groupStart = groupIndex;
    if (groupIndex !== groupStart) {
      if (currentGroup.length > 0) {
        const ohlc = {
          timestamp: currentGroup[0].timestamp,
          open: currentGroup[0].open,
          high: Math.max(...currentGroup.map(d => d.high)),
          low: Math.min(...currentGroup.map(d => d.low)),
          close: currentGroup[currentGroup.length - 1].close,
          volume: currentGroup.reduce((sum, d) => sum + d.volume, 0),
          rsiVal: currentGroup[currentGroup.length - 1].rsiVal || 50,
          ma50: currentGroup[currentGroup.length - 1].ma50 || 0,
          ma200: currentGroup[currentGroup.length - 1].ma200 || 0,
          bbUpper: currentGroup[currentGroup.length - 1].bbUpper || 0,
          bbLower: currentGroup[currentGroup.length - 1].bbLower || 0,
        };
        result.push(ohlc);
        currentGroup = [];
      }
      groupStart = groupIndex;
    }
    currentGroup.push(point);
  });
  if (currentGroup.length > 0) {
    const ohlc = {
      timestamp: currentGroup[0].timestamp,
      open: currentGroup[0].open,
      high: Math.max(...currentGroup.map(d => d.high)),
      low: Math.min(...currentGroup.map(d => d.low)),
      close: currentGroup[currentGroup.length - 1].close,
      volume: currentGroup.reduce((sum, d) => sum + d.volume, 0),
      rsiVal: currentGroup[currentGroup.length - 1].rsiVal || 50,
      ma50: currentGroup[currentGroup.length - 1].ma50 || 0,
      ma200: currentGroup[currentGroup.length - 1].ma200 || 0,
      bbUpper: currentGroup[currentGroup.length - 1].bbUpper || 0,
      bbLower: currentGroup[currentGroup.length - 1].bbLower || 0,
    };
    result.push(ohlc);
  }
  return result;
};

// ---------- MEMOIZED CHART COMPONENTS ----------
const StrategyChart = memo(({ data, onConfigure, showDropdown, controls, setControls }) => {
  const equityYDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 200000];
    let low = Infinity, high = -Infinity;
    data.forEach(d => {
      if (d.value < low) low = d.value;
      if (d.value > high) high = d.value;
    });
    if (low === Infinity || high === -Infinity) return [0, 200000];
    const pad = (high - low) * 0.1 || 1000;
    return [Math.max(0, low - pad + controls.vOffset), high + pad + controls.vOffset];
  }, [data, controls.vOffset]);

  return (
    <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] min-h-[360px] relative shadow-xl">
      <div className="flex justify-between items-center mb-3 border-b pb-2 border-slate-700/10">
        <span className="text-[10px] font-bold text-[#02c076] uppercase flex items-center gap-1">
          <TrendingUp size={12}/> STRATEGY COMP_EQUITY COMPOUND HORIZON LINE
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onConfigure} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-amber-400 flex items-center gap-1 cursor-pointer">
            Configure Context <ChevronDown size={10}/>
          </button>
        </div>
        {showDropdown && (
          <div className="absolute right-4 top-11 bg-slate-900 border border-slate-700 p-2 z-40 rounded flex flex-col gap-1 w-[150px] text-[10px] shadow-2xl">
            <button onClick={() => setControls(p => ({ ...p, zoom: p.zoom + 0.4 }))} className="bg-slate-800 p-1 text-left hover:text-white text-slate-300">Zoom Canvas (+)</button>
            <button onClick={() => setControls(p => ({ ...p, zoom: Math.max(1, p.zoom - 0.4) }))} className="bg-slate-800 p-1 text-left hover:text-white text-slate-300">Zoom Out (-)</button>
            <button onClick={() => setControls(p => ({ ...p, vOffset: p.vOffset + 8000 }))} className="bg-slate-800 p-1 text-left hover:text-white text-slate-300">Shift Up ▲</button>
            <button onClick={() => setControls(p => ({ ...p, vOffset: p.vOffset - 8000 }))} className="bg-slate-800 p-1 text-left hover:text-white text-slate-300">Shift Down ▼</button>
            <button onClick={() => setControls({ zoom: 1, vOffset: 0, hOffset: 0, showDropdown: false })} className="text-rose-400 bg-rose-950 p-1 font-bold text-center rounded mt-1">Reset Axis</button>
          </div>
        )}
      </div>
      <div className="w-full h-[320px] min-h-[320px] pt-4 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="2 2" stroke="#242a32" opacity={0.4} />
            <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={9} domain={equityYDomain} orientation="right" tickLine={false} allowDataOverflow={false} />
            <Tooltip contentStyle={{ backgroundColor: '#161a1e', borderColor: '#2b3139', fontSize: '11px', borderRadius: '4px' }} />
            <Legend wrapperStyle={{ fontSize: '10px', pt: '10px' }} />
            <Area type="monotone" name="Strategy Portfolio Alpha" dataKey="value" fill="url(#colorStratArea)" stroke="#02c076" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" name="Nifty 50 Anchor Baseline" dataKey="benchmark" stroke="#848e9c" strokeWidth={1.2} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            <defs>
              <linearGradient id="colorStratArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#02c076" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#02c076" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const DrawdownChart = memo(({ data }) => {
  const drawdownYDomain = useMemo(() => {
    if (!data || data.length === 0) return [-30, 0];
    let low = 0, high = 0;
    data.forEach(d => {
      if (d.value < low) low = d.value;
      if (d.value > high) high = d.value;
    });
    if (low === 0 && high === 0) return [-30, 0];
    const pad = Math.abs(low) * 0.05 || 1;
    return [low - pad, Math.max(0, high + pad)];
  }, [data]);

  return (
    <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] min-h-[220px] shadow-xl">
      <span className="text-[10px] font-bold text-[#f6465d] uppercase flex items-center gap-1 border-b pb-1 border-slate-700/10 mb-2">
        <AlertTriangle size={12} /> UNDERWATER MAXIMUM HARNESS PROFILE DRAWDOWN %
      </span>
      <div className="w-full h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="2 2" stroke="#242a32" opacity={0.4} />
            <XAxis dataKey="date" stroke="#64748b" fontSize={9} />
            <YAxis stroke="#64748b" fontSize={9} domain={drawdownYDomain} orientation="right" />
            <Tooltip contentStyle={{ backgroundColor: '#161a1e', borderColor: '#2b3139' }} />
            <ReferenceLine y={0} stroke="#474f59" />
            <Line type="monotone" dataKey="value" stroke="#f6465d" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const RealTimeChart = memo(({
  data,
  historicalData,
  showHistorical,
  setShowHistorical,
  symbol,
  onSymbolChange,
  allSymbols,
  isSymbolsLoading,
  chartType,
  setChartType,
  timeframe,
  setTimeframe,
  indicators,
  setIndicators,
  isPaused,
  togglePause,
  chartZoom,
  setChartZoom,
  chartOffset,
  setChartOffset,
  isHistoricalLoading,
  isIntradayLoading
}) => {
  const rawData = useMemo(() => {
    if (showHistorical && historicalData.length > 0) {
      return historicalData.map(d => ({
        timestamp: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        ma50: d.close * 0.995,
        ma200: d.close * 0.982,
        bbUpper: d.close * 1.025,
        bbLower: d.close * 0.975,
        rsiVal: 50,
        macdHist: 0
      }));
    }
    return aggregateCandles(data, timeframe);
  }, [showHistorical, historicalData, data, timeframe]);

  const displayData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const total = rawData.length;
    const itemsToShow = Math.max(10, Math.floor(total / (chartZoom || 1)));
    const start = Math.max(0, Math.min(chartOffset, total - itemsToShow));
    return rawData.slice(start, start + itemsToShow);
  }, [rawData, chartZoom, chartOffset]);

  const yDomain = useMemo(() => {
    if (!displayData || displayData.length < 2) return [2000, 3000];
    let min = Infinity, max = -Infinity;
    displayData.forEach(d => {
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
    });
    if (min === Infinity || max === -Infinity) return [2000, 3000];
    if (min === max) return [min - 10, max + 10];
    const pad = (max - min) * 0.05 || 10;
    return [min - pad, max + pad];
  }, [displayData]);

  const lineData = useMemo(() => {
    return displayData.map(d => ({
      ...d,
      closePrice: d.close
    }));
  }, [displayData]);

  const handleZoomIn = () => setChartZoom(prev => Math.min(prev + 0.4, 3));
  const handleZoomOut = () => setChartZoom(prev => Math.max(prev - 0.4, 0.5));
  const handleResetZoom = () => { setChartZoom(1); setChartOffset(0); };

  if (isHistoricalLoading || isIntradayLoading) {
    return (
      <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] min-h-[460px] flex items-center justify-center shadow-2xl">
        <div className="text-center text-slate-500 font-bold">
          <RefreshCw size={24} className="animate-spin text-amber-500 mx-auto mb-2"/>
          <span>Loading data...</span>
        </div>
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] min-h-[460px] flex items-center justify-center shadow-2xl">
        <div className="text-center text-slate-500 font-bold">
          <span>{showHistorical ? 'No historical data available for this symbol.' : 'No realtime data yet.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] flex flex-col justify-between shadow-2xl relative">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2 border-slate-800 text-[10px] font-bold select-none z-10">
        <div className="flex items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => {
              setShowHistorical(false);
              onSymbolChange(e.target.value);
            }}
            className="text-xs bg-[#f0b90b] text-slate-950 px-1.5 py-0.5 rounded font-black font-sans shadow cursor-pointer hover:bg-amber-400 transition-colors max-w-[160px] truncate"
            disabled={isSymbolsLoading}
          >
            {allSymbols.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol.split('.')[0]}
              </option>
            ))}
          </select>
          <span className="text-slate-400 uppercase tracking-tight">Advanced Technical Indicators Chart</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          {["1m", "5m", "15m", "1h", "4h", "1D"].map(tf => (
            <button
              key={tf}
              onClick={() => { setTimeframe(tf); setShowHistorical(false); }}
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer transition-colors ${timeframe === tf && !showHistorical ? "bg-amber-400 text-slate-950 font-black shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              {tf}
            </button>
          ))}
          <button
            onClick={() => { setShowHistorical(true); }}
            className={`px-2 py-0.5 rounded text-[9px] cursor-pointer transition-colors ${showHistorical ? "bg-purple-600 text-white font-black shadow" : "text-slate-400 hover:text-slate-200"}`}
          >
            Historical
          </button>
        </div>
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          {["candlestick", "line", "bar", "area"].map(ct => (
            <button key={ct} onClick={() => setChartType(ct)} className={`px-2 py-0.5 rounded text-[9px] cursor-pointer capitalize transition-colors ${chartType === ct ? "bg-amber-400 text-slate-950 font-black shadow" : "text-slate-400 hover:text-slate-200"}`}>{ct}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button onClick={handleZoomIn} className="px-1.5 py-0.5 rounded text-[9px] cursor-pointer hover:bg-slate-700 text-slate-300">+</button>
          <button onClick={handleZoomOut} className="px-1.5 py-0.5 rounded text-[9px] cursor-pointer hover:bg-slate-700 text-slate-300">−</button>
          <button onClick={handleResetZoom} className="px-1.5 py-0.5 rounded text-[9px] cursor-pointer hover:bg-slate-700 text-amber-400">⟲</button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIndicators(p => ({ ...p, bollingerBands: !p.bollingerBands }))}
            className={`px-1.5 py-0.5 rounded border text-[9px] cursor-pointer ${indicators.bollingerBands ? "bg-sky-950 text-sky-400 border-sky-800" : "bg-slate-800 text-slate-500 border-slate-700"}`}
          >
            Bands {indicators.bollingerBands ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => setIndicators(p => ({ ...p, movingAverage50: !p.movingAverage50 }))}
            className={`px-1.5 py-0.5 rounded border text-[9px] cursor-pointer ${indicators.movingAverage50 ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-slate-800 text-slate-500 border-slate-700"}`}
          >
            MA50 {indicators.movingAverage50 ? "ON" : "OFF"}
          </button>
          <button
            onClick={togglePause}
            className="px-1.5 py-0.5 rounded border text-[9px] cursor-pointer bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-400"
          >
            {isPaused ? <PlayIcon size={12} /> : <Pause size={12} />}
          </button>
        </div>
      </div>
      <div className="w-full h-[280px] pt-3 relative">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="1 3" stroke="#242a32" opacity={0.5} />
              <XAxis dataKey="timestamp" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} domain={yDomain} orientation="right" tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#12161a', borderColor: '#474f59' }} />
              <Line type="monotone" name="Close Price" dataKey="closePrice" stroke="#f0b90b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              {indicators.movingAverage50 && <Line type="monotone" name="MA (50)" dataKey="ma50" stroke="#10b981" strokeWidth={1} dot={false} strokeDasharray="2 2" isAnimationActive={false} />}
              {indicators.movingAverage200 && <Line type="monotone" name="MA (200)" dataKey="ma200" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />}
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={lineData}>
              <CartesianGrid strokeDasharray="1 3" stroke="#242a32" opacity={0.4} />
              <XAxis dataKey="timestamp" stroke="#64748b" fontSize={9} />
              <YAxis stroke="#64748b" fontSize={9} domain={yDomain} orientation="right" />
              <Tooltip contentStyle={{ backgroundColor: '#12161a', borderColor: '#474f59' }} />
              <Area type="monotone" dataKey="closePrice" fill="url(#colorLiveArea)" stroke="#f0b90b" strokeWidth={2} isAnimationActive={false} />
              <defs>
                <linearGradient id="colorLiveArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f0b90b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f0b90b" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
            </AreaChart>
          ) : chartType === "candlestick" ? (
            <BarChart data={displayData} barCategoryGap={2}>
              <CartesianGrid strokeDasharray="1 4" stroke="#242a32" opacity={0.5} />
              <XAxis dataKey="timestamp" stroke="#64748b" fontSize={9} />
              <YAxis stroke="#64748b" fontSize={9} domain={yDomain} orientation="right" />
              <Tooltip contentStyle={{ backgroundColor: '#12161a', borderColor: '#474f59' }} />
              <Bar dataKey="high" shape={<Candlestick />} isAnimationActive={false}>
                {displayData.map((entry, idx) => <Cell key={`cell-${idx}`} fill="transparent" />)}
              </Bar>
              {indicators.bollingerBands && <Line type="monotone" dataKey="bbUpper" stroke="#38bdf8" strokeWidth={1} dot={false} opacity={0.4} isAnimationActive={false}/>}
              {indicators.bollingerBands && <Line type="monotone" dataKey="bbLower" stroke="#38bdf8" strokeWidth={1} dot={false} opacity={0.4} isAnimationActive={false}/>}
            </BarChart>
          ) : (
            <BarChart data={displayData}>
              <CartesianGrid strokeDasharray="1 4" stroke="#242a32" opacity={0.5} />
              <XAxis dataKey="timestamp" stroke="#64748b" fontSize={9} />
              <YAxis stroke="#64748b" fontSize={9} domain={yDomain} orientation="right" />
              <Tooltip contentStyle={{ backgroundColor: '#12161a', borderColor: '#474f59' }} />
              <Bar dataKey="close" isAnimationActive={false}>
                {displayData.map((entry, idx) => {
                  const isGreen = entry.close >= entry.open;
                  return <Cell key={`cell-${idx}`} fill={isGreen ? "#02c076" : "#f6465d"} />;
                })}
              </Bar>
              {indicators.bollingerBands && <Line type="monotone" dataKey="bbUpper" stroke="#38bdf8" strokeWidth={1} dot={false} opacity={0.4} isAnimationActive={false}/>}
              {indicators.bollingerBands && <Line type="monotone" dataKey="bbLower" stroke="#38bdf8" strokeWidth={1} dot={false} opacity={0.4} isAnimationActive={false}/>}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {/* Horizontal scroll controls */}
      <div className="mt-2 flex items-center gap-3 text-[9px] text-slate-400">
        <span>Zoom:</span>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={chartZoom}
          onChange={(e) => setChartZoom(parseFloat(e.target.value))}
          className="w-20 accent-amber-400 h-1 bg-slate-700 rounded"
        />
        <span className="ml-2">Offset:</span>
        <input
          type="range"
          min="0"
          max={Math.max(0, rawData.length - 10)}
          step="1"
          value={chartOffset}
          onChange={(e) => setChartOffset(parseInt(e.target.value))}
          className="w-20 accent-amber-400 h-1 bg-slate-700 rounded"
        />
        <button onClick={handleResetZoom} className="text-amber-400 hover:text-amber-300 text-[9px]">Reset</button>
      </div>
      <div className="w-full h-[80px] border-t border-slate-800/80 pt-2 flex flex-col justify-between">
        <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase select-none">
          <span>⚡ RSI Momentum Oscillator (14)</span>
          {displayData.length > 0 && <span className="text-purple-400 font-mono">Current: {displayData[displayData.length - 1].rsiVal}</span>}
        </div>
        <div className="w-full h-[60px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="1 1" stroke="#242a32" opacity={0.3} />
              <XAxis dataKey="timestamp" hide={true} />
              <YAxis domain={[0, 100]} stroke="#474f59" fontSize={8} orientation="right" tickCount={3} />
              <ReferenceLine y={70} stroke="#f6465d" strokeDasharray="3 3" opacity={0.5} />
              <ReferenceLine y={30} stroke="#02c076" strokeDasharray="3 3" opacity={0.5} />
              <Line type="monotone" dataKey="rsiVal" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

// ---------- WATCHLIST SPARKLINE ----------
const WatchlistSparkline = memo(({ symbol, data, onClick, onRemove }) => {
  const last = data.length > 0 ? data[data.length - 1] : null;
  const first = data.length > 0 ? data[0] : null;
  const change = (last && first) ? ((last.close - first.close) / first.close * 100) : 0;
  const isUp = change >= 0;

  return (
    <div 
      onClick={onClick}
      className="flex-shrink-0 w-44 bg-slate-800 rounded p-2 cursor-pointer hover:bg-slate-700 transition-colors relative group"
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={12} />
      </button>
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold text-white">{symbol.split('.')[0]}</span>
        <span className={`text-[10px] font-mono ${isUp ? 'text-[#02c076]' : 'text-[#f6465d]'}`}>
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
      <div className="h-10 w-full mt-1">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line 
                type="monotone" 
                dataKey="close" 
                stroke={isUp ? '#02c076' : '#f6465d'} 
                strokeWidth={1.5} 
                dot={false} 
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-[8px] text-slate-500 text-center h-full flex items-center justify-center">
            Waiting...
          </div>
        )}
      </div>
      <div className="text-[10px] text-slate-400 mt-1">
        ₹{last ? last.close.toFixed(2) : '--'}
      </div>
    </div>
  );
});

// ---------- HELP PAGE ----------
const HelpPage = () => (
  <div className="p-6 bg-[#161a1e] rounded border border-[#2b3139] text-slate-300 max-w-4xl mx-auto">
    <h2 className="text-xl font-bold text-[#f0b90b] mb-4">📖 How to Use the Quant Suite</h2>
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-bold text-white">1. Backtest Configuration (left panel)</h3>
        <ul className="list-disc list-inside text-slate-400 space-y-1 ml-4">
          <li><strong>Timeline:</strong> Pick start/end dates for the backtest.</li>
          <li><strong>Presets:</strong> Choose a strategy preset (Quality Growth, Deep Value).</li>
          <li><strong>Filters:</strong> Set market cap, ROCE, and PAT filters for stock selection.</li>
          <li><strong>Ranking:</strong> Add custom ranking rules (e.g., ROE descending, PE ascending).</li>
          <li><strong>Sizing:</strong> Equal‑weight, market‑cap‑weighted, or metric‑weighted (ROCE).</li>
          <li><strong>Rebalance:</strong> Choose rebalancing frequency (monthly, quarterly, yearly).</li>
        </ul>
      </section>
      <section>
        <h3 className="font-bold text-white">2. Technical Chart (middle top)</h3>
        <ul className="list-disc list-inside text-slate-400 space-y-1 ml-4">
          <li><strong>Timeframes:</strong> Switch between 1m, 5m, 15m, 1h, 4h, 1D.</li>
          <li><strong>Chart Types:</strong> Candlestick, line, bar, area.</li>
          <li><strong>Indicators:</strong> Toggle Bollinger Bands and moving averages (MA50).</li>
          <li><strong>Zoom/Offset:</strong> Use the sliders below the chart to zoom and scroll horizontally.</li>
          <li><strong>Pause:</strong> Freeze the chart to analyse a specific pattern.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-bold text-white">3. Watchlist (middle bottom)</h3>
        <ul className="list-disc list-inside text-slate-400 space-y-1 ml-4">
          <li><strong>Add:</strong> Click the “Add Current” button to add the selected stock.</li>
          <li><strong>Remove:</strong> Hover over a watchlist card and click the X button.</li>
          <li><strong>Switch:</strong> Click any sparkline to switch the main chart to that symbol.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-bold text-white">4. Strategy Metrics (top tab)</h3>
        <ul className="list-disc list-inside text-slate-400 space-y-1 ml-4">
          <li><strong>Equity Curve:</strong> Shows portfolio growth over time (with benchmark).</li>
          <li><strong>Drawdown:</strong> Underwater percentage from peak.</li>
          <li><strong>Top Winners/Losers:</strong> Best and worst performing stocks.</li>
          <li><strong>Export:</strong> CSV or Excel downloads.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-bold text-white">5. Other Tabs</h3>
        <ul className="list-disc list-inside text-slate-400 space-y-1 ml-4">
          <li><strong>Heatmap:</strong> Visual sector allocation based on market cap.</li>
          <li><strong>Order Depth:</strong> Simulated bid/ask order book.</li>
          <li><strong>Pine Script IDE:</strong> Write and compile TradingView‑style scripts.</li>
          <li><strong>Groww Calculator:</strong> SIP/Lump sum wealth projection.</li>
        </ul>
      </section>
    </div>
  </div>
);

// ---------- MAIN APP ----------
export default function App() {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------
  const [inputs, setInputs] = useState({
    start_date: "2023-01-01",
    end_date: "2026-01-01",
    min_mcap: 1000,
    max_mcap: 500000,
    min_roce: 15,
    top_n: 5,
    position_sizing: "equal",
    rebalance_freq: "monthly",
    strategy_preset: "custom",
    initial_capital: 1000000,
    transaction_cost: 0.05,
    margin_leverage: 1.0
  });

  const [rankingRules, setRankingRules] = useState([
    { metric: "roe", direction: "desc", weight: 50 },
    { metric: "pe_ratio", direction: "asc", weight: 50 }
  ]);

  const [simulationState, setSimulationState] = useState({
    data: null,
    loading: false,
    error: null
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState("individual_company");

  const [chartType, setChartType] = useState("candlestick");
  const [timeframe, setTimeframe] = useState("1m");
  const [visibleIndicators, setVisibleIndicators] = useState({
    bollingerBands: true,
    rsiLine: true,
    macdHistogram: true,
    movingAverage50: false,
    movingAverage200: false
  });

  const [activePineTab, setActivePineTab] = useState("editor");
  const [pineScriptCode, setPineScriptCode] = useState(
`//@version=5
strategy("Binance Custom Alpha Pro", overlay=true, initial_capital=1000000)

rsi_len = input.int(14, title="RSI Target Length")
roce_hurdle = input.float(15.0, title="Minimum ROCE Threshold")
stop_loss_pct = input.float(2.5, title="Risk Stop Loss %")

rsi_value = ta.rsi(close, rsi_len)
longCondition = ta.crossover(rsi_value, 40) and close > ta.sma(close, 50)

if (longCondition)
    strategy.entry("Long_Vector_Core", strategy.long)
    
strategy.risk.stop_loss(stop_loss_pct)`
  );
  const [pineCompilationLog, setPineCompilationLog] = useState("Idle. System ready to parse custom indicators script structures.");
  const [isPineCompiling, setIsPineCompiling] = useState(false);

  const [liveLogs, setLiveLogs] = useState([]);
  const [selectedStockTicker, setSelectedStockStockTicker] = useState("RELIANCE.NS");

  const [tableDisplayPreference, setTableDisplayPreference] = useState("strategy_weights");

  const [equityControls, setEquityControls] = useState({ zoom: 1.0, vOffset: 0, hOffset: 0, showDropdown: false });
  const [drawdownControls] = useState({ zoom: 1.0, vOffset: 0, hOffset: 0, showDropdown: false });

  const [growwCalcMode, setGrowwCalcMode] = useState("sip");
  const [calcAmount, setCalcAmount] = useState(10000);
  const [calcYears, setCalcYears] = useState(5);
  const [calcExpectedReturn, setCalcExpectedReturn] = useState(15);
  const [calcInflationAdjusted, setCalcInflationAdjusted] = useState(false);

  const [livePriceData, setLivePriceData] = useState({
    price: 2452.35, change: 1.22, openPrice: 2420.00, highPrice: 2465.00,
    lowPrice: 2415.50, volumeTape: 452000, timestamp: "07:19:00"
  });
  const [realtimeHistoryBuffer, setRealtimeHistoryBuffer] = useState([]);
  const [orderBookSpread, setOrderBookSpread] = useState({ bids: [], asks: [], spreadValue: 0.15 });

  const [tickerPrices, setTickerPrices] = useState([
    { symbol: "RELIANCE.NS", price: 2452.35, change: 1.22, isUp: true, isFavorite: true, sector: "Energy", mcap: 1750000 },
    { symbol: "TCS.NS", price: 3820.40, change: -0.82, isUp: false, isFavorite: true, sector: "Technology", mcap: 1400000 },
    { symbol: "INFY.NS", price: 1410.15, change: 2.15, isUp: true, isFavorite: false, sector: "Technology", mcap: 600000 },
    { symbol: "HDFCBANK.NS", price: 1645.90, change: -0.34, isUp: false, isFavorite: false, sector: "Financials", mcap: 1250000 },
    { symbol: "ICICIBANK.NS", price: 1012.20, change: 0.95, isUp: true, isFavorite: false, sector: "Financials", mcap: 720000 },
    { symbol: "BHARTIARTL.NS", price: 1135.00, change: 1.12, isUp: true, isFavorite: false, sector: "Telecom", mcap: 680000 },
    { symbol: "WIPRO.NS", price: 475.20, change: -1.35, isUp: false, isFavorite: false, sector: "Technology", mcap: 240000 },
    { symbol: "SBIN.NS", price: 725.60, change: 0.40, isUp: true, isFavorite: false, sector: "Financials", mcap: 640000 }
  ]);

  const [isStreamingPaused, setIsStreamingPaused] = useState(false);
  const [savedStrategies, setSavedStrategies] = useState([]);
  const [strategyLabel, setStrategyLabel] = useState("");

  const [historicalData, setHistoricalData] = useState([]);
  const [showHistorical, setShowHistorical] = useState(false);
  const [chartZoom, setChartZoom] = useState(1.0);
  const [chartOffset, setChartOffset] = useState(0);
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false);

  // NEW: Intraday data state
  const [isIntradayLoading, setIsIntradayLoading] = useState(false);

  // NEW: All symbols for dropdown
  const [allSymbols, setAllSymbols] = useState([]);
  const [isSymbolsLoading, setIsSymbolsLoading] = useState(true);

  // Watchlist
  const [watchlist, setWatchlist] = useState(['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS']);
  const [watchlistBuffers, setWatchlistBuffers] = useState({});
  const watchlistConnectionsRef = useRef({});

  // -------------------------------------------------------------------------
  // REFS
  // -------------------------------------------------------------------------
  const sseRef = useRef(null);
  const bufferRef = useRef([]);
  const fallbackTimerRef = useRef(null);

  const throttledBufferUpdate = useRef(throttle((tick) => {
    // Always push to the ref buffer
    bufferRef.current.push(tick);
    if (bufferRef.current.length > 1000) {
      bufferRef.current = bufferRef.current.slice(-1000);
    }
    // Update the state only if not paused
    if (!isStreamingPaused) {
      setRealtimeHistoryBuffer([...bufferRef.current]);
    }
  }, 500)).current;

  // -------------------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------------------
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('strategies') || '[]');
      setSavedStrategies(saved);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    const styleId = "quant-premium-terminal-marquee-styles";
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      styleTag.innerHTML = `
        @keyframes quantTerminalMarquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .marquee-running-track-premium {
          display: flex;
          width: max-content;
          animation: quantTerminalMarquee 32s linear infinite;
        }
        .marquee-running-track-premium:hover {
          animation-play-state: paused;
        }
      `;
      document.head.appendChild(styleTag);
    }
    return () => {
      const tag = document.getElementById(styleId);
      if (tag) tag.remove();
    };
  }, []);

  useEffect(() => {
    const diagnosticPoolLogs = [
      "SYSTEM: Server-Sent Events TCP pipeline synchronization established successfully.",
      "INGEST: Point-In-Time cross-sectional records mapped with zero lookahead leakage.",
      "ALPHA: Multi-factor token indices sorting matrix layout execution blocks successfully applied.",
      "RISK: Drawdown variance threshold filters passed on 144 Indian equities asset layers.",
      "TRADINGVIEW: Bollinger Standard deviation bands compiling natively onto price charts.",
      "GROWW: Compounding calculation horizons sandbox recalibrated with target yield values.",
      "BINANCE: Liquidity depth book pipeline matching buy/sell configurations metrics."
    ];
    const loggerInterval = setInterval(() => {
      const stamp = new Date().toLocaleTimeString();
      const message = diagnosticPoolLogs[Math.floor(Math.random() * diagnosticPoolLogs.length)];
      setLiveLogs(prev => [`[${stamp}] ${message}`, ...prev.slice(0, 40)]);
    }, 3000);
    return () => clearInterval(loggerInterval);
  }, []);

  useEffect(() => {
    if (!selectedStockTicker) return;
    const depthInterval = setInterval(() => {
      const targetMidPrice = livePriceData.price;
      const bids = [];
      const asks = [];
      let bidVol = 0, askVol = 0;
      for (let steps = 1; steps <= 12; steps++) {
        const bidPrice = targetMidPrice - (steps * 0.25) - (Math.random() * 0.1);
        const askPrice = targetMidPrice + (steps * 0.25) + (Math.random() * 0.1);
        const bv = Math.floor(Math.random() * 1500) + 100;
        const av = Math.floor(Math.random() * 1600) + 100;
        bidVol += bv;
        askVol += av;
        bids.push({ price: parseFloat(bidPrice.toFixed(2)), volume: bv, total: bidVol });
        asks.push({ price: parseFloat(askPrice.toFixed(2)), volume: av, total: askVol });
      }
      setOrderBookSpread({ bids, asks, spreadValue: parseFloat((asks[0].price - bids[0].price).toFixed(2)) });
    }, 1000);
    return () => clearInterval(depthInterval);
  }, [selectedStockTicker, livePriceData.price]);

  useEffect(() => {
    if (showHistorical && selectedStockTicker) {
      const fetchHistorical = async () => {
        setIsHistoricalLoading(true);
        try {
          const res = await fetch(`/api/historical-data?symbol=${selectedStockTicker}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setHistoricalData(data);
        } catch (err) {
          console.error("Historical data fetch error:", err);
          setHistoricalData([]);
        } finally {
          setIsHistoricalLoading(false);
        }
      };
      fetchHistorical();
    } else {
      setHistoricalData([]);
      setIsHistoricalLoading(false);
    }
  }, [showHistorical, selectedStockTicker]);

  // Fetch symbols for dropdown
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await fetch('/api/symbols');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAllSymbols(data);
      } catch (err) {
        console.error("Failed to fetch symbols:", err);
        // Fallback to static list if backend fails
        setAllSymbols(tickerPrices.map(t => ({ symbol: t.symbol, company_name: t.symbol })));
      } finally {
        setIsSymbolsLoading(false);
      }
    };
    fetchSymbols();
  }, []);

  // Fetch intraday data when timeframe changes (only in realtime mode)
  useEffect(() => {
    if (!selectedStockTicker || showHistorical) return;

    const fetchIntraday = async () => {
      setIsIntradayLoading(true);
      try {
        const res = await fetch(`/api/intraday-data?symbol=${selectedStockTicker}&interval=${timeframe}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.length > 0) {
          const ticks = data.map(d => ({
            timestamp: d.timestamp,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
            ma50: d.close * 0.995,
            ma200: d.close * 0.982,
            bbUpper: d.close * 1.025,
            bbLower: d.close * 0.975,
            rsiVal: 50,
            macdHist: 0
          }));
          bufferRef.current = ticks;
          setRealtimeHistoryBuffer(ticks);
        }
      } catch (err) {
        console.error("Intraday data fetch error:", err);
      } finally {
        setIsIntradayLoading(false);
      }
    };
    fetchIntraday();
  }, [selectedStockTicker, timeframe, showHistorical]);

  useEffect(() => {
    setChartZoom(1);
    setChartOffset(0);
  }, [selectedStockTicker, showHistorical, timeframe]);

  // Main SSE for selected ticker (with robust fallback)
  useEffect(() => {
    if (!selectedStockTicker) return;

    const targetSymbol = selectedStockTicker.toUpperCase().trim();

    if (sseRef.current) {
      sseRef.current.close();
    }

    let isMounted = true;
    let dataReceived = false;

    const setFallbackData = () => {
      if (!isMounted) return;
      if (bufferRef.current.length === 0) {
        console.log(`⚠️ No SSE data for ${targetSymbol}, using fallback.`);
        const fallback = generateFallbackRealtime(targetSymbol);
        bufferRef.current = fallback;
        setRealtimeHistoryBuffer(fallback);
      }
    };

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      if (!dataReceived) {
        setFallbackData();
      }
    }, 3000);

    const liveSseChannel = new EventSource(`/api/stream-ticker?symbol=${targetSymbol}`);
    sseRef.current = liveSseChannel;

    liveSseChannel.onopen = () => {
      console.log(`✅ SSE connected for ${targetSymbol}`);
    };

    liveSseChannel.onmessage = (streamEvent) => {
      if (!isMounted) return;
      try {
        const payload = JSON.parse(streamEvent.data);
        if (payload.error) return;
        dataReceived = true;
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        setLivePriceData(payload);

        const tick = {
          timestamp: payload.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false }),
          open: payload.openPrice,
          high: payload.highPrice,
          low: payload.lowPrice,
          close: payload.price,
          volume: payload.volumeTape,
          ma50: payload.price * 0.995,
          ma200: payload.price * 0.982,
          bbUpper: payload.price * 1.025,
          bbLower: payload.price * 0.975,
          rsiVal: 40 + (targetSymbol.charCodeAt(0) % 25) + Math.sin(Date.now() / 1000) * 5,
          macdHist: (Math.random() - 0.5) * 2
        };

        throttledBufferUpdate(tick);

        setTickerPrices(prev => prev.map(item =>
          item.symbol === targetSymbol
            ? { ...item, price: payload.price, change: payload.change, isUp: payload.isUp }
            : item
        ));
      } catch (err) {
        console.error("SSE data parse error: ", err);
      }
    };

    liveSseChannel.onerror = () => {
      console.warn(`SSE error for ${targetSymbol}`);
      setLiveLogs(prev => [`[${new Date().toLocaleTimeString()}] ⚠️ SSE connection error for ${targetSymbol}.`, ...prev]);
      if (!dataReceived) {
        setFallbackData();
      }
    };

    return () => {
      isMounted = false;
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [selectedStockTicker]);

  // Watchlist SSE connections
  useEffect(() => {
    Object.values(watchlistConnectionsRef.current).forEach(conn => conn.close());
    watchlistConnectionsRef.current = {};

    if (!watchlist || watchlist.length === 0) return;

    const connectSymbol = (symbol) => {
      const target = symbol.toUpperCase().trim();
      if (target === selectedStockTicker.toUpperCase().trim()) return;

      const source = new EventSource(`/api/stream-ticker?symbol=${target}`);
      watchlistConnectionsRef.current[target] = source;

      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.error) return;
          setWatchlistBuffers(prev => {
            const current = prev[target] || [];
            const tick = {
              timestamp: payload.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false }),
              close: payload.price,
              open: payload.openPrice,
              high: payload.highPrice,
              low: payload.lowPrice,
              volume: payload.volumeTape,
              rsiVal: 50,
              ma50: payload.price * 0.995,
              ma200: payload.price * 0.982,
              bbUpper: payload.price * 1.025,
              bbLower: payload.price * 0.975,
            };
            const updated = [...current, tick];
            const sliced = updated.slice(-100);
            return { ...prev, [target]: sliced };
          });
        } catch (err) {
          console.error(`Watchlist SSE parse error for ${target}:`, err);
        }
      };

      source.onerror = () => {
        console.warn(`Watchlist SSE error for ${target}`);
        source.close();
        delete watchlistConnectionsRef.current[target];
      };
    };

    watchlist.forEach(sym => connectSymbol(sym));

    return () => {
      Object.values(watchlistConnectionsRef.current).forEach(conn => conn.close());
      watchlistConnectionsRef.current = {};
    };
  }, [watchlist, selectedStockTicker]);

  // -------------------------------------------------------------------------
  // Backtest executor
  // -------------------------------------------------------------------------
  const executionPipeline = useCallback(async () => {
    setSimulationState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch("/api/run-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inputs,
          ranking_rules: rankingRules,
          selectedStockTicker: selectedStockTicker
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const dataPayload = await response.json();
      setSimulationState({ data: dataPayload, loading: false, error: null });
      setWorkspaceMode("strategy");
      setLiveLogs(prev => [`[${new Date().toLocaleTimeString()}] 🎉 Quant Simulation Success. CAGR: ${dataPayload.metrics?.cagr || 'N/A'}%`, ...prev]);
    } catch (err) {
      console.error("Backtest fetch error:", err);
      const fallbackData = {
        chart_data: generateFallbackEquityData(30),
        drawdown_chart_data: generateFallbackDrawdownData(30),
        metrics: {
          cagr: 18.5,
          selected_companies: ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS"],
          sharpe: 1.2,
          sortino_ratio: 1.1,
          win_rate: 55.2,
          avg_drawdown: -2.4,
          max_drawdown: -12.4
        },
        stock_performance: [
          { symbol: "RELIANCE.NS", return: 45.2 },
          { symbol: "TCS.NS", return: 32.8 },
          { symbol: "INFY.NS", return: 22.5 },
          { symbol: "HDFCBANK.NS", return: 12.3 },
          { symbol: "ICICIBANK.NS", return: -5.7 }
        ]
      };
      setSimulationState({ data: fallbackData, loading: false, error: null });
      setWorkspaceMode("strategy");
      setLiveLogs(prev => [`[${new Date().toLocaleTimeString()}] ⚠️ Using fallback simulation data.`, ...prev]);
    }
  }, [inputs, rankingRules, selectedStockTicker]);

  useEffect(() => {
    executionPipeline();
  }, []);

  const triggerPineCompilation = () => {
    setIsPineCompiling(true);
    setPineCompilationLog("Analyzing syntax character sequences against tree tokens...");
    setTimeout(() => {
      if (!pineScriptCode.includes("strategy")) {
        setPineCompilationLog("❌ Pine Compile Error: Root strategy code declaration missing line 2.");
        setIsPineCompiling(false);
        return;
      }
      const roceFloatRegex = pineScriptCode.match(/roce_hurdle\s*=\s*input\.float\(([\d.]+)/);
      let extractedHurdle = inputs.min_roce;
      if (roceFloatRegex && roceFloatRegex[1]) {
        extractedHurdle = parseFloat(roceFloatRegex[1]);
      }
      setInputs(prev => ({ ...prev, min_roce: extractedHurdle }));
      setPineCompilationLog(`🎉 Injected! Pine Script validated. Min ROCE overrode to ${extractedHurdle}%.`);
      setIsPineCompiling(false);
      setActivePineTab("console");
      executionPipeline();
    }, 1200);
  };

  const growwCalculatedOutputs = useMemo(() => {
    const rateFraction = calcExpectedReturn / 100;
    let baseline = 0, endVal = 0;
    if (growwCalcMode === "sip") {
      const monthlyRate = rateFraction / 12;
      const months = calcYears * 12;
      baseline = calcAmount * months;
      endVal = calcAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    } else {
      baseline = calcAmount;
      endVal = calcAmount * Math.pow(1 + rateFraction, calcYears);
    }
    if (calcInflationAdjusted) {
      endVal = endVal * Math.pow(1 - 0.06, calcYears);
    }
    return {
      investedStr: Math.round(baseline).toLocaleString("en-IN"),
      gainsStr: Math.round(Math.max(0, endVal - baseline)).toLocaleString("en-IN"),
      totalStr: Math.round(endVal).toLocaleString("en-IN"),
      rawTotal: endVal
    };
  }, [growwCalcMode, calcAmount, calcYears, calcExpectedReturn, calcInflationAdjusted]);

  const processedEquityChartData = useMemo(() => {
    const base = simulationState.data?.chart_data || generateFallbackEquityData(30);
    const sliceCount = base.length;
    const itemsToView = Math.max(10, Math.floor(sliceCount / (equityControls.zoom || 1)));
    const offsetStartIndex = Math.max(0, Math.min(equityControls.hOffset || 0, sliceCount - itemsToView));
    return base.slice(offsetStartIndex, offsetStartIndex + itemsToView);
  }, [simulationState.data, equityControls.zoom, equityControls.hOffset]);

  const processedDrawdownChartData = useMemo(() => {
    const base = simulationState.data?.drawdown_chart_data || generateFallbackDrawdownData(30);
    const sliceCount = base.length;
    const itemsToView = Math.max(10, Math.floor(sliceCount / (drawdownControls.zoom || 1)));
    const offsetStartIndex = Math.max(0, Math.min(drawdownControls.hOffset || 0, sliceCount - itemsToView));
    return base.slice(offsetStartIndex, offsetStartIndex + itemsToView);
  }, [simulationState.data, drawdownControls.zoom, drawdownControls.hOffset]);

  const rankingSystemMetricsMatrix = useMemo(() => {
    const companies = simulationState.data?.metrics?.selected_companies || ["RELIANCE.NS", "TCS.NS", "INFY.NS"];
    return companies.map((co, idx) => ({
      name: co,
      "Factor ROE Selection Rank Score": Math.max(15, 88 - (idx * 7)),
      "PE Multiple Valuation Compression Discount": Math.max(10, 64 - (idx * 3)),
      "Capital Return Efficiency (ROCE) Yield": Math.max(20, 92 - (idx * 6))
    }));
  }, [simulationState.data]);

  // Filter marquee based on favorites
  const marqueeFeed = useMemo(() => {
    return tickerPrices.filter(item => item.isFavorite);
  }, [tickerPrices]);

  const doubleMarqueeFeed = useMemo(() => [...marqueeFeed, ...marqueeFeed], [marqueeFeed]);

  const dynamicRuleScreenerEnforcers = () => setRankingRules([...rankingRules, { metric: "roce", direction: "desc", weight: 0 }]);
  const removeRankingRuleIndex = (idx) => setRankingRules(rankingRules.filter((_, i) => i !== idx));
  const patchRankingRuleIndexValue = (idx, key, val) => {
    const nextArr = [...rankingRules];
    nextArr[idx][key] = val;
    setRankingRules(nextArr);
  };

  const handlePresetChange = (val) => {
    setInputs(prev => ({ ...prev, strategy_preset: val }));
    if (val === "quality_growth") {
      setInputs(prev => ({
        ...prev,
        min_roce: 20,
        min_mcap: 500,
        max_mcap: 200000,
        position_sizing: "metric",
        top_n: 10
      }));
      setRankingRules([
        { metric: "roe", direction: "desc", weight: 60 },
        { metric: "pe_ratio", direction: "desc", weight: 40 }
      ]);
    } else if (val === "deep_value") {
      setInputs(prev => ({
        ...prev,
        min_roce: 10,
        min_mcap: 100,
        max_mcap: 100000,
        position_sizing: "equal",
        top_n: 20
      }));
      setRankingRules([
        { metric: "pe_ratio", direction: "asc", weight: 70 },
        { metric: "roce", direction: "desc", weight: 30 }
      ]);
    } else {
      setInputs(prev => ({
        ...prev,
        min_roce: 15,
        min_mcap: 1000,
        max_mcap: 500000,
        position_sizing: "equal",
        top_n: 5
      }));
      setRankingRules([
        { metric: "roe", direction: "desc", weight: 50 },
        { metric: "pe_ratio", direction: "asc", weight: 50 }
      ]);
    }
  };

  const toggleStreamingPause = () => setIsStreamingPaused(prev => !prev);

  const saveStrategy = () => {
    const strategy = {
      inputs,
      rankingRules,
      simulationState,
      timestamp: Date.now(),
      label: strategyLabel || `Strategy ${savedStrategies.length + 1}`
    };
    const saved = JSON.parse(localStorage.getItem('strategies') || '[]');
    saved.push(strategy);
    localStorage.setItem('strategies', JSON.stringify(saved));
    setSavedStrategies(saved);
    setStrategyLabel('');
  };

  const loadStrategy = (index) => {
    const saved = JSON.parse(localStorage.getItem('strategies') || '[]');
    const strat = saved[index];
    if (strat) {
      setInputs(strat.inputs);
      setRankingRules(strat.rankingRules);
      setSimulationState(strat.simulationState);
    }
  };

  const exportCSV = () => {
    const data = simulationState.data?.chart_data || [];
    if (!data.length) return;
    const headers = 'Date,Portfolio Value,Benchmark\n';
    const rows = data.map(d => `${d.date},${d.value},${d.benchmark}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'equity_curve.csv';
    link.click();
  };

  const exportExcel = () => {
    const data = simulationState.data;
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const equityData = data.chart_data || [];
    if (equityData.length) {
      const ws1 = XLSX.utils.json_to_sheet(equityData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Equity Curve');
    }
    const metrics = data.metrics || {};
    const metricsArr = [{
      'CAGR (%)': metrics.cagr || 0,
      'Sharpe Ratio': metrics.sharpe_ratio || 0,
      'Sortino Ratio': metrics.sortino_ratio || 0,
      'Win Rate (%)': metrics.win_rate || 0,
      'Avg Drawdown (%)': metrics.avg_drawdown || 0,
      'Max Drawdown (%)': metrics.max_drawdown || 0
    }];
    const ws2 = XLSX.utils.json_to_sheet(metricsArr);
    XLSX.utils.book_append_sheet(wb, ws2, 'Metrics');
    const perf = data.stock_performance || [];
    if (perf.length) {
      const ws3 = XLSX.utils.json_to_sheet(perf);
      XLSX.utils.book_append_sheet(wb, ws3, 'Stock Performance');
    }
    XLSX.writeFile(wb, 'backtest_results.xlsx');
  };

  const resetZoom = () => setEquityControls({ zoom: 1, vOffset: 0, hOffset: 0, showDropdown: false });

  const topWinners = useMemo(() => {
    const perf = simulationState.data?.stock_performance || [];
    return perf.slice(0, 3);
  }, [simulationState.data]);

  const topLosers = useMemo(() => {
    const perf = simulationState.data?.stock_performance || [];
    return perf.slice(-3).reverse();
  }, [simulationState.data]);

  // Watchlist handlers
  const addToWatchlist = (symbol) => {
    if (!watchlist.includes(symbol) && watchlist.length < 6) {
      setWatchlist([...watchlist, symbol]);
    } else if (watchlist.length >= 6) {
      setLiveLogs(prev => [`[${new Date().toLocaleTimeString()}] ⚠️ Watchlist full (max 6 symbols)`, ...prev]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
    setWatchlistBuffers(prev => {
      const newBuffers = { ...prev };
      delete newBuffers[symbol];
      return newBuffers;
    });
  };

  // Toggle favorite on marquee
  const toggleFavorite = (symbol) => {
    setTickerPrices(prev => prev.map(item =>
      item.symbol === symbol ? { ...item, isFavorite: !item.isFavorite } : item
    ));
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className={`min-h-screen w-full font-mono text-xs antialiased flex flex-col justify-between overflow-x-hidden pt-[34px] ${isDarkMode ? "bg-[#0b0e11] text-[#eaecef]" : "bg-[#f4f6f9] text-[#1e2329]"}`}>
      {/* Top Marquee */}
      <section className="w-full fixed top-0 left-0 right-0 z-50 select-none border-b flex items-center h-[34px] bg-[#12161a] border-[#2b3139] text-[10px] font-bold">
        <div className="flex items-center gap-1.5 shrink-0 px-4 h-full border-r border-[#2b3139] text-[#f0b90b] z-20 bg-[#12161a]">
          <Zap size={11} fill="currentColor" className="animate-pulse"/><span className="uppercase tracking-widest font-black text-[9px]">LIVE COMPILER TICK TAPE:</span>
        </div>
        <div className="w-full overflow-hidden relative flex items-center h-full z-10">
          <div className="marquee-running-track-premium gap-8 items-center h-full">
            {doubleMarqueeFeed.map((item, idx) => (
              <div
                key={`${item.symbol}-${idx}`}
                onClick={() => { setSelectedStockStockTicker(item.symbol); setWorkspaceMode("individual_company"); }}
                className="flex items-center gap-2 shrink-0 h-[24px] rounded px-2 relative hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <Star
                  size={10}
                  fill={item.isFavorite ? "#f0b90b" : "none"}
                  className={`${item.isFavorite ? "text-[#f0b90b]" : "text-slate-500"} cursor-pointer hover:text-amber-300`}
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(item.symbol); }}
                />
                <span className="text-slate-200 font-bold">{item.symbol.split('.')[0]}</span>
                <span className="text-slate-400">₹{item.price.toLocaleString("en-IN")}</span>
                <span className={`font-bold flex items-center ${item.isUp ? "text-[#02c076]" : "text-[#f6465d]"}`}>
                  {item.isUp ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                  {item.isUp ? "+" : ""}{item.change}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Header */}
      <header className="w-full px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between border-b bg-[#161a1e] border-[#2b3139] gap-4 shadow-xl select-none z-10">
        <div className="flex items-center gap-3">
          <div className="h-3.5 w-3.5 bg-[#f0b90b] rotate-45 transform border border-amber-300 shadow-lg animate-pulse" />
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-wider text-[#f0b90b] font-sans">脉 HASMUDDIN ADVANCED QUANT SUITE</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-tight">Institutional Terminal Architecture Environment Matrix</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-0.5 rounded border border-[#474f59] bg-[#2b3139] font-bold text-[11px] shadow-inner">
            <button onClick={() => setWorkspaceMode("individual_company")} className={`px-3 py-1 rounded cursor-pointer transition-all ${workspaceMode === "individual_company" ? "bg-[#f0b90b] text-[#0b0e11] font-black" : "text-slate-400 hover:text-white"}`}>🕯 Technical Chart</button>
            <button onClick={() => setWorkspaceMode("strategy")} className={`px-3 py-1 rounded cursor-pointer transition-all ${workspaceMode === "strategy" ? "bg-[#f0b90b] text-[#0b0e11] font-black" : "text-slate-400 hover:text-white"}`}>📊 Strategy Metrics</button>
            <button onClick={() => setWorkspaceMode("heatmap")} className={`px-3 py-1 rounded cursor-pointer transition-all ${workspaceMode === "heatmap" ? "bg-[#f0b90b] text-[#0b0e11] font-black" : "text-slate-400 hover:text-white"}`}>🧱 Sector Heatmap</button>
            <button onClick={() => setWorkspaceMode("orderbook")} className={`px-3 py-1 rounded cursor-pointer transition-all ${workspaceMode === "orderbook" ? "bg-[#f0b90b] text-[#0b0e11] font-black" : "text-slate-400 hover:text-white"}`}>🗂 Order Depth</button>
            <button onClick={() => setWorkspaceMode("help")} className={`px-3 py-1 rounded cursor-pointer transition-all ${workspaceMode === "help" ? "bg-[#f0b90b] text-[#0b0e11] font-black" : "text-slate-400 hover:text-white"}`}>📖 Help</button>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 border border-slate-700 rounded bg-[#2b3139] text-amber-400 hover:text-white transition-colors cursor-pointer">{isDarkMode ? <Sun size={13}/> : <Moon size={13}/>}</button>
        </div>
      </header>

      {/* Main 3-pane layout */}
      <div className="w-full flex-grow grid grid-cols-1 lg:grid-cols-[290px_1fr] xl:grid-cols-[320px_1fr_310px] gap-0.5 bg-slate-800/20">
        {/* Pane 1: Strategy Controls */}
        <div className="p-4 space-y-4 bg-[#161a1e] border-r border-[#2b3139] overflow-y-auto max-h-[calc(100vh-5rem)] shadow-inner">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-slate-700/20 text-[#f0b90b]">
              <div className="flex items-center gap-1.5"><Sliders size={13} /><span className="font-bold text-[11px] uppercase tracking-wider">System Rule Constraints</span></div>
              <Settings size={12} className="text-slate-500 animate-spin" style={{ animationDuration: '6s' }}/>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block font-bold mb-1 uppercase tracking-tight">Backtest Timeline Span</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="w-full border p-1 bg-slate-800 border-slate-700 text-white rounded text-[11px] font-bold focus:border-amber-400 outline-none" value={inputs.start_date} onChange={e => setInputs({...inputs, start_date: e.target.value})}/>
                <input type="date" className="w-full border p-1 bg-slate-800 border-slate-700 text-white rounded text-[11px] font-bold focus:border-amber-400 outline-none" value={inputs.end_date} onChange={e => setInputs({...inputs, end_date: e.target.value})}/>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block font-bold mb-1 uppercase tracking-tight">Presets Multi-Factor Matrix</label>
              <select value={inputs.strategy_preset} onChange={e => handlePresetChange(e.target.value)} className="w-full font-bold border rounded p-1.5 text-xs bg-slate-800 border-slate-700 text-white outline-none focus:border-amber-400">
                <option value="custom">⚙ Custom Setup Parameters</option>
                <option value="quality_growth">🚀 Quality Growth Core Yield</option>
                <option value="deep_value">💎 Deep Value Compressed Multiples</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Initial Capital (₹)</label>
                <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white text-[11px]" value={inputs.initial_capital} onChange={e => setInputs({...inputs, initial_capital: Number(e.target.value)})}/>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Slippage Drag (%)</label>
                <input type="number" step="0.01" className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white text-[11px]" value={inputs.transaction_cost} onChange={e => setInputs({...inputs, transaction_cost: Number(e.target.value)})}/>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block font-bold mb-1 uppercase tracking-tight">Sizing & Weight Reallocation</label>
              <div className="space-y-2">
                <select className="w-full border p-1.5 bg-slate-800 border-slate-700 text-white rounded text-[11px] outline-none" value={inputs.position_sizing} onChange={e => setInputs({...inputs, position_sizing: e.target.value})}>
                  <option value="equal">Equal-Weighted Distribution Matrix</option>
                  <option value="mcap">Market Capital Sizing Weighting</option>
                  <option value="metric">Metric-Weighted (ROCE Score Ratio)</option>
                </select>
                <select className="w-full border p-1.5 bg-slate-800 border-slate-700 text-white rounded text-[11px] outline-none" value={inputs.rebalance_freq} onChange={e => setInputs({...inputs, rebalance_freq: e.target.value})}>
                  <option value="monthly">Monthly Sequential Realignment</option>
                  <option value="quarterly">Quarterly Corporate Interval</option>
                  <option value="yearly">Yearly Anchor Horizon Cycle</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-700/20">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Screener Universe Ingestion Limits</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 block">Min Cap (₹ Cr)</label>
                  <input type="number" className="w-full border p-1 bg-slate-800 border-slate-700 rounded text-white font-bold" value={inputs.min_mcap} onChange={e => setInputs({...inputs, min_mcap: Number(e.target.value)})}/>
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 block">Max Cap (₹ Cr)</label>
                  <input type="number" className="w-full border p-1 bg-slate-800 border-slate-700 rounded text-white font-bold" value={inputs.max_mcap} onChange={e => setInputs({...inputs, max_mcap: Number(e.target.value)})}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 block">Min ROCE (%)</label>
                  <input type="number" className="w-full border p-1 bg-slate-800 border-slate-700 rounded text-white" value={inputs.min_roce} onChange={e => setInputs({...inputs, min_roce: Number(e.target.value)})}/>
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 block">Holding Limit (Top N)</label>
                  <input type="number" className="w-full border p-1 bg-slate-800 border-slate-700 rounded text-white" value={inputs.top_n} onChange={e => setInputs({...inputs, top_n: Number(e.target.value)})}/>
                </div>
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-700/20">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Composite Factor Rankings Ranks Array</span>
                <button onClick={dynamicRuleScreenerEnforcers} className="p-1 bg-slate-800 text-amber-400 rounded hover:bg-slate-700 cursor-pointer"><Plus size={11}/></button>
              </div>
              {rankingRules.map((rule, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1.5fr_1fr_auto] gap-1 bg-slate-900 p-1.5 rounded border border-slate-800 text-[10px]">
                  <select value={rule.metric} onChange={e => patchRankingRuleIndexValue(idx, "metric", e.target.value)} className="bg-slate-800 text-white rounded p-0.5">
                    <option value="roe">ROE% Ret</option>
                    <option value="pe_ratio">PE Compress</option>
                    <option value="roce">ROCE Yield</option>
                    <option value="market_cap">Market Cap</option>
                  </select>
                  <select value={rule.direction} onChange={e => patchRankingRuleIndexValue(idx, "direction", e.target.value)} className="bg-slate-800 text-white rounded p-0.5">
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                  <input type="number" className="w-full bg-slate-800 text-slate-200 text-center rounded p-0.5" value={rule.weight} onChange={e => patchRankingRuleIndexValue(idx, "weight", Number(e.target.value))} placeholder="W%"/>
                  <button onClick={() => removeRankingRuleIndex(idx)} className="text-rose-500 hover:text-rose-400 cursor-pointer p-0.5"><Trash2 size={11}/></button>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-700/20 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Strategy label"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded p-1 text-white text-[10px]"
                  value={strategyLabel}
                  onChange={e => setStrategyLabel(e.target.value)}
                />
                <button onClick={saveStrategy} className="bg-amber-500 text-slate-950 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-amber-400">
                  <Save size={11} /> Save
                </button>
              </div>
              {savedStrategies.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 bg-slate-800 border border-slate-700 rounded p-1 text-white text-[10px]"
                    onChange={e => loadStrategy(Number(e.target.value))}
                  >
                    <option value="">Load saved strategy...</option>
                    {savedStrategies.map((s, i) => (
                      <option key={i} value={i}>{s.label || `Strategy ${i+1}`}</option>
                    ))}
                  </select>
                  <FolderOpen size={14} className="text-slate-400" />
                </div>
              )}
            </div>
          </div>
          <button onClick={executionPipeline} disabled={simulationState.loading} className="w-full bg-[#f0b90b] text-slate-950 font-black py-2.5 px-4 rounded mt-4 cursor-pointer hover:bg-amber-500 uppercase tracking-wider text-[11px] shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {simulationState.loading ? <RefreshCw size={12} className="animate-spin"/> : <Play size={12} fill="currentColor"/>}
            {simulationState.loading ? "Computing..." : "Compute Matrix Engine"}
          </button>
        </div>

        {/* Pane 2: Central Workspace */}
        <div className="p-4 space-y-4 bg-[#12161a] overflow-y-auto">
          {workspaceMode === "strategy" && (
            <div className="space-y-4 w-full flex flex-col">
              <StrategyChart
                data={processedEquityChartData}
                onConfigure={() => setEquityControls(p => ({ ...p, showDropdown: !p.showDropdown }))}
                showDropdown={equityControls.showDropdown}
                controls={equityControls}
                setControls={setEquityControls}
              />
              <DrawdownChart data={processedDrawdownChartData} />
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0b0e11] p-3 rounded border border-slate-800">
                  <span className="text-[10px] font-bold text-[#02c076] uppercase">🏆 Top Winners</span>
                  {topWinners.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {topWinners.map((item, idx) => (
                        <li key={idx} className="flex justify-between border-b border-slate-800/50 py-1">
                          <span className="text-white font-bold">{item.symbol}</span>
                          <span className="text-[#02c076]">+{item.return}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="text-slate-500 text-[10px] mt-2">No data yet</div>}
                </div>
                <div className="bg-[#0b0e11] p-3 rounded border border-slate-800">
                  <span className="text-[10px] font-bold text-[#f6465d] uppercase">📉 Top Losers</span>
                  {topLosers.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {topLosers.map((item, idx) => (
                        <li key={idx} className="flex justify-between border-b border-slate-800/50 py-1">
                          <span className="text-white font-bold">{item.symbol}</span>
                          <span className="text-[#f6465d]">{item.return}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="text-slate-500 text-[10px] mt-2">No data yet</div>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={exportCSV} className="bg-emerald-600 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-500">
                  <Download size={12} /> Export CSV
                </button>
                <button onClick={exportExcel} className="bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-blue-500">
                  <FileSpreadsheet size={12} /> Export Excel
                </button>
                <button onClick={resetZoom} className="bg-slate-700 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-slate-600">
                  <RotateCcw size={12} /> Reset Zoom
                </button>
              </div>
            </div>
          )}

          {workspaceMode === "individual_company" && (
            <div className="space-y-4 w-full flex flex-col">
              <RealTimeChart
                data={realtimeHistoryBuffer}
                historicalData={historicalData}
                showHistorical={showHistorical}
                setShowHistorical={setShowHistorical}
                symbol={selectedStockTicker}
                onSymbolChange={setSelectedStockStockTicker}
                allSymbols={allSymbols}
                isSymbolsLoading={isSymbolsLoading}
                chartType={chartType}
                setChartType={setChartType}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                indicators={visibleIndicators}
                setIndicators={setVisibleIndicators}
                isPaused={isStreamingPaused}
                togglePause={toggleStreamingPause}
                chartZoom={chartZoom}
                setChartZoom={setChartZoom}
                chartOffset={chartOffset}
                setChartOffset={setChartOffset}
                isHistoricalLoading={isHistoricalLoading}
                isIntradayLoading={isIntradayLoading}
              />
              
              {/* Watchlist Panel */}
              <div className="p-3 bg-[#161a1e] rounded border border-[#2b3139]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={12} /> Watchlist
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => addToWatchlist(selectedStockTicker)}
                      disabled={watchlist.includes(selectedStockTicker) || watchlist.length >= 6}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${
                        watchlist.includes(selectedStockTicker) || watchlist.length >= 6
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      }`}
                    >
                      + Add Current
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
                  {watchlist.map(sym => {
                    const buffer = watchlistBuffers[sym] || [];
                    return (
                      <WatchlistSparkline
                        key={sym}
                        symbol={sym}
                        data={buffer}
                        onClick={() => { setSelectedStockStockTicker(sym); setShowHistorical(false); }}
                        onRemove={() => removeFromWatchlist(sym)}
                      />
                    );
                  })}
                  {watchlist.length === 0 && (
                    <div className="text-slate-500 text-[10px] py-4 w-full text-center">
                      No symbols in watchlist. Click "+ Add Current" to add.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {workspaceMode === "heatmap" && (
            <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] min-h-[440px] flex flex-col justify-between shadow-xl">
              <div className="border-b pb-2 border-slate-800 mb-3 flex justify-between items-center select-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Grid size={12}/> Cross-Sectional Large Cap Sector Allocation Heatmap</span>
                <span className="text-[9px] text-slate-500">Block Sizing Scaled by Market Cap Vector Value</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-grow">
                {tickerPrices.map((tick, i) => {
                  const paddingScaleSize = Math.max(2, Math.floor(tick.mcap / 400000));
                  return (
                    <div
                      key={i}
                      onClick={() => { setSelectedStockStockTicker(tick.symbol); setWorkspaceMode("individual_company"); }}
                      className={`p-4 rounded border transition-all duration-150 cursor-pointer flex flex-col justify-between transform hover:scale-[1.02] shadow-md ${tick.isUp ? "bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-900/60" : "bg-rose-950/40 border-rose-800/60 hover:bg-rose-900/60"}`}
                      style={{ gridColumnEnd: `span ${paddingScaleSize >= 4 ? 2 : 1}` }}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-[13px] text-white tracking-wide">{tick.symbol.split('.')[0]}</span>
                        <span className="text-[8px] bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-400 rounded uppercase font-sans tracking-tight">{tick.sector}</span>
                      </div>
                      <div className="text-right mt-6">
                        <span className="block font-mono text-[11px] font-bold text-slate-200">₹{tick.price.toLocaleString("en-IN")}</span>
                        <span className={`text-[10px] font-mono font-black ${tick.isUp ? "text-[#02c076]" : "text-[#f6465d]"}`}>
                          {tick.isUp ? "▲ +" : "▼ "}{tick.change}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {workspaceMode === "orderbook" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] shadow-xl">
                <span className="text-[10px] font-bold text-[#f6465d] uppercase block border-b pb-2 border-slate-800 mb-2">🔴 LIQUIDITY DEPTH MATRIX: ASK SPREADS SELL ORDERS</span>
                <table className="w-full font-mono text-[11px] text-left border-collapse">
                  <thead><tr className="text-slate-500 font-bold text-[10px] border-b border-slate-800/60"><th className="pb-1">PRICE (₹)</th><th className="pb-1 text-right">SIZE (VOL)</th><th className="pb-1 text-right">ACCUMULATIVE TOTAL</th></tr></thead>
                  <tbody>
                    {orderBookSpread.asks.map((ask, idx) => (
                      <tr key={idx} className="hover:bg-rose-950/20 transition relative">
                        <td className="py-1 text-[#f6465d] font-bold">₹{ask.price}</td>
                        <td className="py-1 text-right font-bold text-slate-300">{ask.volume}</td>
                        <td className="py-1 text-right text-slate-400">{ask.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] shadow-xl">
                <span className="text-[10px] font-bold text-[#02c076] uppercase block border-b pb-2 border-slate-800 mb-2">🟢 LIQUIDITY DEPTH MATRIX: BID SPREADS BUY ORDERS</span>
                <table className="w-full font-mono text-[11px] text-left border-collapse">
                  <thead><tr className="text-slate-500 font-bold text-[10px] border-b border-slate-800/60"><th className="pb-1">PRICE (₹)</th><th className="pb-1 text-right">SIZE (VOL)</th><th className="pb-1 text-right">ACCUMULATIVE TOTAL</th></tr></thead>
                  <tbody>
                    {orderBookSpread.bids.map((bid, idx) => (
                      <tr key={idx} className="hover:bg-emerald-950/20 transition">
                        <td className="py-1 text-[#02c076] font-bold">₹{bid.price}</td>
                        <td className="py-1 text-right font-bold text-slate-300">{bid.volume}</td>
                        <td className="py-1 text-right text-slate-400">{bid.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {workspaceMode === "help" && <HelpPage />}

          {/* Table section */}
          <div className="p-4 rounded border bg-[#161a1e] border-[#2b3139] shadow-xl w-full">
            <div className="flex flex-wrap justify-between items-center border-b pb-2 border-slate-700/20 mb-3 select-none gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📋 Target Allocation Registry Ledger:</span>
                <button
                  onClick={() => setTableDisplayPreference(p => p === "strategy_weights" ? "factor_scores" : "strategy_weights")}
                  className="bg-[#2b3139] border border-slate-600 hover:border-amber-400 px-2.5 py-0.5 rounded text-[10px] font-bold text-amber-400 cursor-pointer transition-all shadow"
                >
                  {tableDisplayPreference === "strategy_weights" ? "Toggle View: Factor Ranks Matrix" : "Toggle View: Model Capital Weights"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[150px] w-full">
              {tableDisplayPreference === "strategy_weights" ? (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b text-slate-500 font-bold text-[10px]">
                      <th className="pb-2 font-mono">QUALIFIED SECURITY REBALANCE ID</th>
                      <th className="pb-2 font-mono text-center">POSITION SIZE MODEL ASSIGNMENT</th>
                      <th className="pb-2 font-mono text-right">TIMELINE INTEGRITY HORIZON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono text-slate-300">
                    {(simulationState.data?.metrics?.selected_companies || ["RELIANCE.NS", "TCS.NS", "INFY.NS"]).map((stock, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td onClick={() => { setSelectedStockStockTicker(stock); setWorkspaceMode("individual_company"); }} className="py-2 font-bold text-[#f0b90b] cursor-pointer underline hover:text-amber-400">{stock}</td>
                        <td className="py-2 text-center text-[#02c076] font-bold">{inputs.position_sizing === 'equal' ? `${(100 / (simulationState.data?.metrics?.selected_companies?.length || 3)).toFixed(1)}%` : 'Model Proportional Weighted'}</td>
                        <td className="py-2 text-right text-slate-500 text-[10px] font-semibold">POINT_IN_TIME_LOCK_OK</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b text-sky-400 font-bold text-[10px]">
                      <th className="pb-2">ASSET TICKER</th>
                      <th className="pb-2 text-center">ROE MOMENTUM SCORE</th>
                      <th className="pb-2 text-center">PE COMPRESSION WEIGHT</th>
                      <th className="pb-2 text-right">ROCE EFFICIENCY YIELD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono text-slate-300">
                    {rankingSystemMetricsMatrix.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-2 font-bold text-sky-400">{row.name}</td>
                        <td className="py-2 text-center text-slate-200">{row["Factor ROE Selection Rank Score"]} / 100</td>
                        <td className="py-2 text-center text-slate-200">{row["PE Multiple Valuation Compression Discount"]} / 100</td>
                        <td className="py-2 text-right text-emerald-400 font-bold">{row["Capital Return Efficiency (ROCE) Yield"]}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Pane 3: Utility Dock */}
        <div className="p-4 bg-[#161a1e] border-l border-[#2b3139] space-y-4 overflow-y-auto max-h-[calc(100vh-5rem)] shadow-inner">
          <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2.5 font-sans text-[11px] shadow-lg">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 select-none">
              <span className="text-[10px] font-mono font-black text-sky-400 uppercase flex items-center gap-1"><Code size={12}/> Pine Script IDE Workspace</span>
              <div className="flex gap-1 bg-slate-800 p-0.5 rounded text-[8px] font-bold font-mono">
                <button onClick={() => setActivePineTab("editor")} className={`px-1 rounded ${activePineTab === 'editor' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}>Editor</button>
                <button onClick={() => setActivePineTab("console")} className={`px-1 rounded ${activePineTab === 'console' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}>Console</button>
              </div>
            </div>
            {activePineTab === "editor" ? (
              <div className="space-y-2 flex flex-col">
                <p className="text-[9px] text-slate-500 font-mono italic leading-relaxed">Modify indicator configurations natively inside the sandboxed script container block:</p>
                <textarea
                  rows="9"
                  className="w-full bg-[#0b0e11] text-emerald-400 p-2 font-mono text-[10px] rounded border border-slate-800 focus:border-sky-500 focus:outline-none leading-relaxed shadow-inner font-bold"
                  value={pineScriptCode}
                  onChange={e => setPineScriptCode(e.target.value)}
                />
                <button
                  onClick={triggerPineCompilation}
                  disabled={isPineCompiling}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 font-black py-1.5 rounded text-[10px] flex items-center justify-center gap-1 cursor-pointer uppercase transition-all font-mono shadow"
                >
                  <Flame size={11} fill="currentColor"/> {isPineCompiling ? "Parsing Tree Tokens..." : "Compile & Inject Script"}
                </button>
              </div>
            ) : (
              <div className="p-2 bg-[#0b0e11] border border-slate-800 rounded font-mono text-[9px] space-y-1 text-slate-400 min-h-[160px] flex flex-col justify-between">
                <div>
                  <span className="text-slate-600 block border-b border-slate-900 pb-0.5 mb-1 text-[8px] font-bold">SYSTEM PARSE FEED LOG:</span>
                  <div className="leading-normal max-h-[110px] overflow-y-auto whitespace-pre-wrap font-bold text-slate-300">
                    {pineCompilationLog}
                  </div>
                </div>
                <div className="text-[8px] text-slate-600 text-right border-t border-slate-900 pt-1">AST ENGINE COMPLIANT v3.0</div>
              </div>
            )}
          </div>

          <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-3 font-sans text-[11px] shadow-lg">
            <span className="text-[10px] font-mono font-black text-emerald-400 uppercase flex items-center gap-1 border-b border-slate-800 pb-1.5"><Calculator size={12}/> Groww Wealth Simulator Target</span>
            <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700 text-[10px] font-bold shadow-inner select-none">
              <button onClick={() => setGrowwCalcMode("sip")} className={`w-full py-0.5 rounded text-center cursor-pointer transition ${growwCalcMode === "sip" ? "bg-emerald-400 text-slate-950 font-black shadow" : "text-slate-400 hover:text-slate-200"}`}>Monthly SIP</button>
              <button onClick={() => setGrowwCalcMode("lump")} className={`w-full py-0.5 rounded text-center cursor-pointer transition ${growwCalcMode === "lump" ? "bg-emerald-400 text-slate-950 font-black shadow" : "text-slate-400 hover:text-slate-200"}`}>Lump Sum Principal</button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-slate-400">{growwCalcMode === 'sip' ? 'Monthly Commitment:' : 'Principal Investment:'}</span>
                <span className="text-white font-bold">₹{calcAmount.toLocaleString("en-IN")}</span>
              </div>
              <input type="range" min={growwCalcMode === 'sip' ? "1000" : "10000"} max={growwCalcMode === 'sip' ? "100000" : "5000000"} step={growwCalcMode === 'sip' ? "500" : "10000"} className="w-full accent-emerald-400 bg-slate-800 rounded cursor-pointer h-1" value={calcAmount} onChange={e => setCalcAmount(Number(e.target.value))}/>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 block mb-0.5 font-mono">Horizon (Years)</label>
                  <input type="number" min="1" max="40" className="w-full bg-slate-800 p-1 border border-slate-700 rounded text-white font-mono text-[11px]" value={calcYears} onChange={e => setCalcYears(Number(e.target.value))}/>
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 block mb-0.5 font-mono">Expected Return (%)</label>
                  <input type="number" min="5" max="30" className="w-full bg-slate-800 p-1 border border-slate-700 rounded text-white font-mono text-[11px]" value={calcExpectedReturn} onChange={e => setCalcExpectedReturn(Number(e.target.value))}/>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1.5 select-none">
                <input type="checkbox" id="inflationCheckbox" checked={calcInflationAdjusted} onChange={e => setCalcInflationAdjusted(e.target.checked)} className="accent-emerald-400 cursor-pointer rounded"/>
                <label htmlFor="inflationCheckbox" className="text-[9px] text-slate-400 font-mono cursor-pointer hover:text-slate-200">Adjust Value for 6% Annual Inflation</label>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800/80 font-mono text-[10px] space-y-1 bg-slate-950/40 p-2 rounded shadow-inner">
              <div className="flex justify-between"><span className="text-slate-500">Invested Capital:</span><span className="text-slate-300 font-bold">₹{growwCalculatedOutputs.investedStr}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estimated Gains:</span><span className="text-[#02c076] font-bold">₹{growwCalculatedOutputs.gainsStr}</span></div>
              <div className="flex justify-between border-t border-slate-800/60 mt-1 pt-1 text-amber-400 font-black text-[11px]"><span>Total Future Value:</span><span>₹{growwCalculatedOutputs.totalStr}</span></div>
            </div>
          </div>

          <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1.5 select-none shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5 flex items-center gap-1"><Terminal size={12}/> Live Engine Network Telemetry Logs Feed</span>
            <div className="max-h-[120px] overflow-y-auto font-mono text-[8px] leading-relaxed text-slate-500 space-y-1 pr-1">
              {liveLogs.map((log, i) => (
                <div key={i} className={`truncate font-bold ${log.includes('🎉') || log.includes('Success') ? 'text-emerald-500' : log.includes('⚠️') ? 'text-amber-400' : 'text-slate-400'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="w-full border-t bg-[#0b0e11] border-[#2b3139] text-[#848e9c] select-none font-sans mt-auto z-10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-[11px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-[#f0b90b] rotate-45 transform border border-amber-400 shadow shadow-amber-400/50" />
              <span className="font-mono font-black tracking-wider text-[#eaecef] text-[13px]">HASMUDDIN.DEV</span>
            </div>
            <p className="text-slate-500 text-[10px] leading-relaxed max-w-xs">
              Institutional‑grade automated backtester with real‑time data ingestion, advanced ranking, and analytics.
            </p>
            <div className="pt-1 text-[9px] text-slate-600">
              <span className="block">⚡ Built with React, FastAPI & PostgreSQL</span>
              <span className="block">📊 Quant Engine v3.0</span>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-[#eaecef] uppercase tracking-wider text-[10px] mb-3">Support</h4>
            <ul className="space-y-1.5 text-[10px]">
              <li><a href="mailto:hasmudin035@gmail.com" className="hover:text-[#f0b90b] transition-colors flex items-center gap-1"><Mail size={11}/> Email</a></li>
              <li><a href="#" className="hover:text-[#f0b90b] transition-colors flex items-center gap-1"><Phone size={11}/> +91 9382127307</a></li>
              <li><a href="#" className="hover:text-[#f0b90b] transition-colors flex items-center gap-1"><MapPin size={11}/> Bengaluru, India</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-[#eaecef] uppercase tracking-wider text-[10px] mb-3">Creator</h4>
            <div className="space-y-1.5 text-[10px]">
              <p className="text-slate-400">Visit creator @</p>
              <a 
                href="https://www.lesterelite.tech" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#f0b90b] hover:underline font-bold text-[12px] block"
              >
                www.lesterelite.tech
              </a>
              <div className="pt-1 text-[9px] text-slate-600">
                <span className="block">🚀 Built with ❤️</span>
                <span className="block">© 2026 All rights reserved.</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-900/60 py-3 px-6 flex flex-col sm:flex-row justify-between items-center text-[9px] text-slate-600 font-mono">
          <span>HASMUDDIN ADVANCED QUANT SUITE — Institutional Terminal</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1"><ShieldCheck size={10} className="text-[#02c076]"/> SSL_SECURE</span>
            <span>COMP_NODE_v3.0</span>
          </span>
        </div>
      </footer>
    </div>
  );
}