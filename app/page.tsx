'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

// ─────────────────────────────────────────
// 型
// ─────────────────────────────────────────
interface Params {
  propertyPrice: number
  downPaymentRate: number
  loanYears: number
  rate1: number; rate2: number; rate3: number
  mgmt1: number; mgmt2: number
  fixedTax: number; mortgageDeduction: number
  sellCostRate: number
  rentStart: number; rentHike: number
  rentDeposit: number; renewalFee: number
  investReturn: number
  years: number
  finalPriceGrowthRate: number
}

// ─────────────────────────────────────────
// シミュレーション
// ─────────────────────────────────────────
function simulate(p: Params) {
  const months = p.years * 12
  const principal = p.propertyPrice * 10000 * (1 + p.downPaymentRate / 100)

  function mpmt(bal: number, ar: number, rm: number) {
    const r = ar / 100 / 12
    if (r === 0) return bal / rm
    return bal * r * Math.pow(1 + r, rm) / (Math.pow(1 + r, rm) - 1)
  }

  let loanBalance = principal
  const totalLoanMonths = p.loanYears * 12
  let buyInvestAsset = 0
  const chartData: any[] = []
  let rentInvestAsset = 0
  let rentCarryOver = 0

  for (let m = 1; m <= months; m++) {
    const year = Math.ceil(m / 12)
    let rate = p.rate3
    if (year <= 3) rate = p.rate1
    else if (year <= 6) rate = p.rate2

    const remainMonths = totalLoanMonths - (m - 1)
    const payment = remainMonths > 0 ? mpmt(loanBalance, rate, remainMonths) : 0

    if (remainMonths > 0) {
      const interest = loanBalance * (rate / 100 / 12)
      loanBalance = Math.max(0, loanBalance - (payment - interest))
    }

    const mgmt = (year <= 5 ? p.mgmt1 : p.mgmt2) * 10000
    const annualNetTaxBenefit = (p.mortgageDeduction - p.fixedTax) * 10000
    const isJune = m % 12 === 6
    const buyMonthlyCost = payment + mgmt
    const mir = Math.pow(1 + p.investReturn / 100, 1 / 12) - 1

    if (isJune && year <= 10) {
      buyInvestAsset = (buyInvestAsset + annualNetTaxBenefit) * (1 + mir)
    } else {
      buyInvestAsset *= (1 + mir)
    }

    const rentPeriod = Math.floor((m - 1) / 24)
    const rentMonthly = (p.rentStart + rentPeriod * p.rentHike) * 10000
    const renewalFeeAmt = (m > 1 && (m - 1) % 24 === 0) ? rentMonthly * p.renewalFee : 0
    const depositAmt = m === 1 ? (p.rentStart * 10000) * p.rentDeposit : 0

    let investable = buyMonthlyCost - rentMonthly - depositAmt - renewalFeeAmt + rentCarryOver
    if (investable >= 0) {
      rentInvestAsset = rentInvestAsset * (1 + mir) + investable
      rentCarryOver = 0
    } else {
      rentInvestAsset = rentInvestAsset * (1 + mir)
      rentCarryOver = investable
    }

    // 物件価値（現在価値）
    const propertyValue = p.propertyPrice * 10000 * Math.pow(1 + p.finalPriceGrowthRate / 100, m / 12)
    // 購入純資産 = 物件価値 - ローン残高 + 投資資産
    const buyNetWorth = propertyValue - loanBalance + buyInvestAsset

    chartData.push({
      month: m, year: m / 12,
      buyMonthlyPayment: Math.round(buyMonthlyCost / 10000),
      rentMonthly: Math.round(rentMonthly / 10000),
      buyLoanBalance: Math.round(loanBalance / 10000),
      buyInvestAsset: Math.round(buyInvestAsset / 10000),
      rentInvestAsset: Math.round(rentInvestAsset / 10000),
      buyNetWorth: Math.round(buyNetWorth / 10000),
      rentNetWorth: Math.round(rentInvestAsset / 10000),
      // 積み上げグラフ用（万円）
      propertyValue: Math.round(propertyValue / 10000),
      loanBalance: Math.round(loanBalance / 10000),
    })
  }

  const finalPropertyValue = p.propertyPrice * 10000 * Math.pow(1 + p.finalPriceGrowthRate / 100, p.years)
  const sellCost = finalPropertyValue * (p.sellCostRate / 100)
  const finalLoanBalance = loanBalance
  const profit = finalPropertyValue - p.propertyPrice * 10000 * (1 + p.downPaymentRate / 100)
  const taxableProfit = Math.max(0, profit - 30000000)
  const capitalGainsTax = taxableProfit > 0 ? taxableProfit * 0.20315 : 0

  const buyFinalNetWorth = finalPropertyValue - sellCost - finalLoanBalance - capitalGainsTax + buyInvestAsset
  const rentFinalNetWorth = rentInvestAsset

  function calcBuyAtPrice(sp: number): number {
    const sc = sp * (p.sellCostRate / 100)
    const pr = sp - p.propertyPrice * 10000 * (1 + p.downPaymentRate / 100)
    const taxP = Math.max(0, pr - 30000000) * 0.20315
    return sp - sc - finalLoanBalance - taxP + buyInvestAsset
  }

  let lo = 0, hi = p.propertyPrice * 10000 * 3
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (calcBuyAtPrice(mid) < rentFinalNetWorth) lo = mid
    else hi = mid
  }
  const breakEvenPrice = Math.round((lo + hi) / 2 / 10000)
  const breakEvenGrowthRate = (breakEvenPrice / p.propertyPrice - 1) * 100
  const breakEvenAnnualRate = (Math.pow(1 + breakEvenGrowthRate / 100, 1 / p.years) - 1) * 100

  return {
    chartData,
    buyFinalNetWorth: Math.round(buyFinalNetWorth / 10000),
    rentFinalNetWorth: Math.round(rentFinalNetWorth / 10000),
    breakEvenPrice, breakEvenGrowthRate, breakEvenAnnualRate,
    finalLoanBalance: Math.round(finalLoanBalance / 10000),
    finalPropertyValue: Math.round(finalPropertyValue / 10000),
    buyInvestAsset: Math.round(buyInvestAsset / 10000),
    rentInvestAsset: Math.round(rentInvestAsset / 10000),
  }
}

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────
function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 10000) return `${(n / 10000).toFixed(2)}億`
  return `${n.toLocaleString()}万`
}

const DEFAULT: Params = {
  propertyPrice: 14000, downPaymentRate: 7, loanYears: 35,
  rate1: 1.5, rate2: 1.75, rate3: 2.0,
  mgmt1: 4, mgmt2: 6, fixedTax: 20, mortgageDeduction: 31.5,
  sellCostRate: 4, rentStart: 33, rentHike: 1.5,
  rentDeposit: 1, renewalFee: 1, investReturn: 7,
  years: 10, finalPriceGrowthRate: 0.43,
}

const GREEN  = '#30d158'
const GRAY   = '#8e8e93'
const RED    = '#ff453a'
const BLUE   = '#0a84ff'
const YELLOW = '#ffd60a'

// ─────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────
const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#2c2c2e', border: '1px solid #38383a', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: GRAY, marginBottom: 4 }}>{Number(label).toFixed(1)}年後</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>{p.name}：{fmt(p.value)}円</p>
      ))}
    </div>
  )
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  // 積み上げから純資産を計算: 物件価値 - ローン + 投資
  const pv = payload.find((p: any) => p.dataKey === 'propertyValue')?.value ?? 0
  const lb = payload.find((p: any) => p.dataKey === 'loanBalance')?.value ?? 0
  const bi = payload.find((p: any) => p.dataKey === 'buyInvestAsset')?.value ?? 0
  const net = pv - lb + bi
  return (
    <div style={{ background: '#2c2c2e', border: '1px solid #38383a', borderRadius: 10, padding: '8px 12px', fontSize: 12, minWidth: 140 }}>
      <p style={{ color: GRAY, marginBottom: 6 }}>{Number(label).toFixed(1)}年後</p>
      <p style={{ color: GREEN,  margin: '2px 0' }}>物件価値：{fmt(pv)}円</p>
      <p style={{ color: RED,    margin: '2px 0' }}>ローン残：−{fmt(lb)}円</p>
      <p style={{ color: YELLOW, margin: '2px 0' }}>投資資産：{fmt(bi)}円</p>
      <p style={{ color: '#fff', margin: '6px 0 0', paddingTop: 6, borderTop: '1px solid #38383a', fontWeight: 600 }}>
        純資産：{fmt(net)}円
      </p>
    </div>
  )
}

// ─────────────────────────────────────────
// スライダー
// ─────────────────────────────────────────
function SliderRow({ label, value, min, max, step, unit, onChange, color }: {
  label: string; value: number; min: number; max: number; step: number
  unit?: string; onChange: (v: number) => void; color?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const c = color ?? '#fff'
  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 15 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums' }}>
          {value.toLocaleString()}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', background: `linear-gradient(to right, ${c} ${pct}%, #3a3a3c ${pct}%)` }}
      />
    </div>
  )
}

function SliderCell({ label, value, min, max, step, unit, onChange, color, last }: {
  label: string; value: number; min: number; max: number; step: number
  unit?: string; onChange: (v: number) => void; color?: string; last?: boolean
}) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: last ? 'none' : '1px solid #2c2c2e' }}>
      <SliderRow label={label} value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} color={color} />
    </div>
  )
}

// ─────────────────────────────────────────
// リスト行
// ─────────────────────────────────────────
function Row({ label, value, color, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <div style={{
      padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: last ? 'none' : '1px solid #2c2c2e',
    }}>
      <span style={{ fontSize: 15, color: GRAY }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: color ?? '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────
// Section
// ─────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 13, color: GRAY, letterSpacing: '0.02em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 8 }}>
        {title}
      </p>
      <div style={{ background: '#1c1c1e', borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// 設定タブピル
// ─────────────────────────────────────────
type SettingsTab = 'buy' | 'rent'

function SettingsTabPill({ active, onChange }: { active: SettingsTab; onChange: (t: SettingsTab) => void }) {
  return (
    <div style={{
      display: 'flex',
      background: '#2c2c2e',
      borderRadius: 10,
      padding: 2,
      marginBottom: 24,
    }}>
      {([
        { key: 'buy' as const,  label: '🏠 購入条件', color: GREEN },
        { key: 'rent' as const, label: '🔑 賃貸条件', color: BLUE },
      ]).map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            flex: 1,
            padding: '10px 8px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            background: active === t.key ? '#1c1c1e' : 'transparent',
            color: active === t.key ? t.color : GRAY,
            transition: 'all 0.2s',
            boxShadow: active === t.key ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────
// メイン
// ─────────────────────────────────────────
type ResultTab = 'chart' | 'monthly' | 'breakdown'

export default function Home() {
  const [p, setP]           = useState<Params>(DEFAULT)
  const [resultTab, setResultTab] = useState<ResultTab>('chart')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('buy')
  const [view, setView]     = useState<'result' | 'settings'>('result')

  const set = (key: keyof Params) => (v: number) => setP(prev => ({ ...prev, [key]: v }))
  const r = useMemo(() => simulate(p), [p])
  const yearlyData = useMemo(() => r.chartData.filter((d: any) => d.month % 12 === 0), [r.chartData])

  const buyWins  = r.buyFinalNetWorth >= r.rentFinalNetWorth
  const diff     = Math.abs(r.buyFinalNetWorth - r.rentFinalNetWorth)
  const diffColor = buyWins ? GREEN : RED

  // 積み上げグラフ用：ローン残高をマイナスとして表示するためネガティブ化
  const stackData = yearlyData.map((d: any) => ({
    ...d,
    loanBalanceNeg: -d.loanBalance, // 積み上げ上はマイナス側に出す
  }))

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: '#000' }}>

      {/* ─── ヘッダー ─── */}
      <div style={{
        padding: '56px 16px 0',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>購入 vs 賃貸</h1>
          <button
            onClick={() => setView(v => v === 'result' ? 'settings' : 'result')}
            style={{ background: '#2c2c2e', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 14, fontWeight: 500 }}
          >
            {view === 'result' ? '条件変更' : '結果を見る'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: GRAY, marginBottom: 12 }}>
          {(p.propertyPrice / 10000).toFixed(1)}億円 · {p.years}年シミュレーション
        </p>

        {/* 結果タブ */}
        {view === 'result' && (
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #2c2c2e' }}>
            {([
              { k: 'chart' as const,     l: '純資産' },
              { k: 'monthly' as const,   l: '月次支出' },
              { k: 'breakdown' as const, l: '内訳' },
            ]).map(t => (
              <button key={t.k} onClick={() => setResultTab(t.k)} style={{
                flex: 1, padding: '10px 4px', fontSize: 13,
                fontWeight: resultTab === t.k ? 600 : 400,
                color: resultTab === t.k ? '#fff' : GRAY,
                borderBottom: resultTab === t.k ? '2px solid #fff' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>{t.l}</button>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────
          結果画面
      ───────────────────────────────────────── */}
      {view === 'result' && (
        <div>
          <div style={{ padding: '20px 16px 0' }}>

            {/* 勝者カード */}
            <div style={{ background: '#1c1c1e', borderRadius: 16, padding: '20px', marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>{p.years}年後の結果</p>
              <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 16 }}>
                {buyWins ? '🏠 購入が有利' : '🔑 賃貸が有利'}
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[
                  { label: '購入 純資産', val: r.buyFinalNetWorth },
                  { label: '賃貸 投資資産', val: r.rentFinalNetWorth },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, background: '#2c2c2e', borderRadius: 12, padding: '12px' }}>
                    <p style={{ fontSize: 11, color: GRAY, marginBottom: 4 }}>{item.label}</p>
                    <p style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(item.val)}円
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #2c2c2e' }}>
                <span style={{ fontSize: 14, color: GRAY }}>差額</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: diffColor, fontVariantNumeric: 'tabular-nums' }}>
                  {buyWins ? '+' : '-'}{fmt(diff)}円
                </span>
              </div>
            </div>

            {/* 損益分岐点 */}
            <div style={{ background: '#1c1c1e', borderRadius: 16, padding: '16px 20px', marginBottom: 4 }}>
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 12 }}>損益分岐点（購入有利ライン）</p>
              {[
                { label: '必要売却価格', val: `${fmt(r.breakEvenPrice)}円`, c: undefined },
                { label: '総上昇率', val: `${r.breakEvenGrowthRate >= 0 ? '+' : ''}${r.breakEvenGrowthRate.toFixed(2)}%`, c: r.breakEvenGrowthRate >= 0 ? GREEN : RED },
                { label: '年率換算', val: `${r.breakEvenAnnualRate >= 0 ? '+' : ''}${r.breakEvenAnnualRate.toFixed(2)}%/年`, c: r.breakEvenAnnualRate >= 0 ? GREEN : RED },
              ].map((item, i, arr) => (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0,
                  borderBottom: i < arr.length - 1 ? '1px solid #2c2c2e' : 'none',
                }}>
                  <span style={{ fontSize: 14, color: GRAY }}>{item.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: item.c ?? '#fff', fontVariantNumeric: 'tabular-nums' }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── 純資産タブ ─── */}
          {resultTab === 'chart' && (
            <div style={{ paddingTop: 16 }}>
              <div style={{ padding: '0 16px 10px', display: 'flex', gap: 16 }}>
                {[{ c: GREEN, l: '購入 純資産' }, { c: GRAY, l: '賃貸 投資資産' }].map(item => (
                  <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.c }} />
                    <span style={{ fontSize: 12, color: GRAY }}>{item.l}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={yearlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GRAY} stopOpacity={0.2} /><stop offset="95%" stopColor={GRAY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" stroke="#3a3a3c" tick={{ fontSize: 11, fill: GRAY }} tickFormatter={v => `${v}年`} tickLine={false} axisLine={false} />
                  <YAxis stroke="none" tick={false} width={0} />
                  <Tooltip content={<LineTooltip />} />
                  <ReferenceLine y={0} stroke="#3a3a3c" strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="buyNetWorth" stroke={GREEN} strokeWidth={2} fill="url(#g1)" name="購入 純資産" dot={false} />
                  <Area type="monotone" dataKey="rentNetWorth" stroke={GRAY} strokeWidth={2} fill="url(#g2)" name="賃貸 投資資産" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ─── 月次支出タブ ─── */}
          {resultTab === 'monthly' && (
            <div style={{ paddingTop: 16 }}>
              <div style={{ padding: '0 16px 10px', display: 'flex', gap: 16 }}>
                {[{ c: GREEN, l: '購入 月次コスト' }, { c: BLUE, l: '賃貸 家賃' }].map(item => (
                  <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.c }} />
                    <span style={{ fontSize: 12, color: GRAY }}>{item.l}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={yearlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} /><stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" stroke="#3a3a3c" tick={{ fontSize: 11, fill: GRAY }} tickFormatter={v => `${v}年`} tickLine={false} axisLine={false} />
                  <YAxis stroke="none" tick={false} width={0} />
                  <Tooltip content={<LineTooltip />} />
                  <Area type="monotone" dataKey="buyMonthlyPayment" stroke={GREEN} strokeWidth={2} fill="url(#g3)" name="購入 月次コスト(万)" dot={false} />
                  <Area type="monotone" dataKey="rentMonthly" stroke={BLUE} strokeWidth={2} fill="url(#g4)" name="賃貸 家賃(万)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ─── 内訳タブ（積み上げ棒グラフ） ─── */}
          {resultTab === 'breakdown' && (
            <div style={{ paddingTop: 16 }}>
              <div style={{ padding: '0 16px 10px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {[
                  { c: GREEN,  l: '物件価値' },
                  { c: RED,    l: 'ローン残（マイナス）' },
                  { c: YELLOW, l: '投資資産' },
                ].map(item => (
                  <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.c }} />
                    <span style={{ fontSize: 11, color: GRAY }}>{item.l}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stackData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <XAxis dataKey="year" stroke="#3a3a3c" tick={{ fontSize: 11, fill: GRAY }} tickFormatter={v => `${v}年`} tickLine={false} axisLine={false} />
                  <YAxis stroke="none" tick={false} width={0} />
                  <Tooltip content={<BarTooltip />} />
                  <ReferenceLine y={0} stroke="#555" />
                  {/* プラス側：物件価値 → 投資資産の順に積み上げ */}
                  <Bar dataKey="propertyValue" name="物件価値" stackId="buy" fill={GREEN} radius={[0,0,0,0]} />
                  <Bar dataKey="buyInvestAsset" name="投資資産" stackId="buy" fill={YELLOW} radius={[4,4,0,0]} />
                  {/* マイナス側：ローン残をネガティブ表示 */}
                  <Bar dataKey="loanBalanceNeg" name="ローン残" stackId="buy" fill={RED} radius={[0,0,4,4]} />
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: '#48484a', textAlign: 'center', padding: '4px 16px 0' }}>
                緑＋黄（上）からローン残（下）を引いた差が純資産
              </p>
            </div>
          )}

          {/* 内訳リスト */}
          <div style={{ padding: '16px 16px 48px' }}>
            <Section title="購入側の内訳">
              <Row label="ローン借入元本" value={`${fmt(Math.round(p.propertyPrice * (1 + p.downPaymentRate / 100)))}円`} />
              <Row label={`${p.years}年後ローン残高`} value={`${fmt(r.finalLoanBalance)}円`} />
              <Row label={`${p.years}年後物件価値`} value={`${fmt(r.finalPropertyValue)}円`} />
              <Row label="投資資産（控除差額）" value={`${fmt(r.buyInvestAsset)}円`} />
              <Row label="純資産" value={`${fmt(r.buyFinalNetWorth)}円`} color={GREEN} last />
            </Section>
            <Section title="賃貸側の内訳">
              <Row label="初期家賃" value={`${p.rentStart}万円/月`} />
              <Row label={`${p.years}年後の家賃（推定）`} value={`${p.rentStart + Math.floor(p.years / 2) * p.rentHike}万円/月`} />
              <Row label="投資資産（差額積立）" value={`${fmt(r.rentInvestAsset)}円`} />
              <Row label="純資産" value={`${fmt(r.rentFinalNetWorth)}円`} color={BLUE} last />
            </Section>
            <p style={{ fontSize: 12, color: '#48484a', textAlign: 'center', lineHeight: 1.7 }}>
              このシミュレーターは参考目的のみです。<br />
              重要な意思決定には専門家へのご相談をおすすめします。
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────
          設定画面
      ───────────────────────────────────────── */}
      {view === 'settings' && (
        <div style={{ padding: '20px 16px 80px' }}>

          {/* 購入 / 賃貸 ピルタブ */}
          <SettingsTabPill active={settingsTab} onChange={setSettingsTab} />

          {/* ─── 購入条件 ─── */}
          {settingsTab === 'buy' && (
            <>
              {/* アクセントライン */}
              <div style={{ height: 3, background: `linear-gradient(90deg, ${GREEN}, transparent)`, borderRadius: 2, marginBottom: 20 }} />

              <Section title="物件・ローン">
                <SliderCell label="物件価格" value={p.propertyPrice} min={5000} max={30000} step={500} unit="万円" onChange={set('propertyPrice')} color={GREEN} />
                <SliderCell label="諸費用率" value={p.downPaymentRate} min={3} max={12} step={0.5} unit="%" onChange={set('downPaymentRate')} />
                <SliderCell label="ローン年数" value={p.loanYears} min={10} max={35} step={5} unit="年" onChange={set('loanYears')} last />
              </Section>

              <Section title="金利（段階的上昇）">
                <SliderCell label="1〜3年目" value={p.rate1} min={0.5} max={3} step={0.05} unit="%" onChange={set('rate1')} />
                <SliderCell label="4〜6年目" value={p.rate2} min={0.5} max={3.5} step={0.05} unit="%" onChange={set('rate2')} />
                <SliderCell label="7年目以降" value={p.rate3} min={0.5} max={4} step={0.05} unit="%" onChange={set('rate3')} last />
              </Section>

              <Section title="管理費・税金">
                <SliderCell label="管理費+修繕（1〜5年）" value={p.mgmt1} min={1} max={15} step={0.5} unit="万/月" onChange={set('mgmt1')} />
                <SliderCell label="管理費+修繕（6〜10年）" value={p.mgmt2} min={1} max={20} step={0.5} unit="万/月" onChange={set('mgmt2')} />
                <SliderCell label="固定資産税" value={p.fixedTax} min={5} max={50} step={1} unit="万/年" onChange={set('fixedTax')} />
                <SliderCell label="住宅ローン控除" value={p.mortgageDeduction} min={0} max={60} step={0.5} unit="万/年" onChange={set('mortgageDeduction')} />
                <SliderCell label="売却コスト" value={p.sellCostRate} min={2} max={8} step={0.5} unit="%" onChange={set('sellCostRate')} last />
              </Section>

              <Section title="マンション価格予測">
                <SliderCell
                  label="価格上昇率（年率）"
                  value={p.finalPriceGrowthRate} min={-3} max={5} step={0.1} unit="%/年"
                  onChange={set('finalPriceGrowthRate')} last
                  color={p.finalPriceGrowthRate >= 0 ? GREEN : RED}
                />
              </Section>
            </>
          )}

          {/* ─── 賃貸条件 ─── */}
          {settingsTab === 'rent' && (
            <>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${BLUE}, transparent)`, borderRadius: 2, marginBottom: 20 }} />

              <Section title="家賃">
                <SliderCell label="初期家賃" value={p.rentStart} min={10} max={80} step={1} unit="万/月" onChange={set('rentStart')} color={BLUE} />
                <SliderCell label="2年ごとの家賃上昇" value={p.rentHike} min={0} max={5} step={0.5} unit="万円" onChange={set('rentHike')} last />
              </Section>

              <Section title="初期費用・更新">
                <SliderCell label="礼金" value={p.rentDeposit} min={0} max={3} step={0.5} unit="ヶ月" onChange={set('rentDeposit')} />
                <SliderCell label="更新料（2年ごと）" value={p.renewalFee} min={0} max={3} step={0.5} unit="ヶ月" onChange={set('renewalFee')} last />
              </Section>

              <Section title="投資・シミュレーション">
                <SliderCell label="インデックス投資 年利" value={p.investReturn} min={2} max={15} step={0.5} unit="%" onChange={set('investReturn')} color={GREEN} />
                <SliderCell label="シミュレーション期間" value={p.years} min={5} max={20} step={1} unit="年" onChange={set('years')} last />
              </Section>
            </>
          )}

          {/* リセット */}
          <button
            onClick={() => setP(DEFAULT)}
            style={{ width: '100%', background: '#1c1c1e', color: RED, borderRadius: 12, padding: '16px', fontSize: 16, fontWeight: 500, marginTop: 8 }}
          >
            デフォルトに戻す
          </button>
        </div>
      )}
    </div>
  )
}
