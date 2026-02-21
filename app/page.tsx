'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

// ─────────────────────────────────────────
// 型
// ─────────────────────────────────────────
interface Params {
  // 共通
  years: number
  investReturn: number
  finalPriceGrowthRate: number
  sellCostRate: number          // 共通っぽい（購入売却コストだが比較前提）
  // 購入
  propertyPrice: number
  downPayment: number           // 頭金（万円）
  loanYears: number
  rate1: number; rate2: number; rate3: number
  mgmt1: number; mgmt2: number
  fixedTax: number
  // 賃貸
  rentStart: number; rentHike: number
  rentDeposit: number; renewalFee: number
  movingCost: number            // 引越し費用（万円・更新のたびに発生）
}

// ─────────────────────────────────────────
// シミュレーション
// ─────────────────────────────────────────
function simulate(p: Params) {
  const months = p.years * 12
  // 頭金を差し引いた借入元本（諸費用はオーバーローン込み）
  const loanPrincipal = Math.max(0, p.propertyPrice * 10000 - p.downPayment * 10000 + p.propertyPrice * 10000 * 0.07)
  // 頭金の機会コスト：頭金分を投資に回した場合の資産
  let downPaymentInvest = p.downPayment * 10000

  function mpmt(bal: number, ar: number, rm: number) {
    const r = ar / 100 / 12
    if (r === 0) return bal / rm
    return bal * r * Math.pow(1 + r, rm) / (Math.pow(1 + r, rm) - 1)
  }

  // 金利：シミュレーション期間を3等分
  const seg = Math.ceil(p.years / 3)
  function getRate(year: number) {
    if (year <= seg) return p.rate1
    if (year <= seg * 2) return p.rate2
    return p.rate3
  }

  let loanBalance = loanPrincipal
  const totalLoanMonths = p.loanYears * 12
  let buyInvestAsset = 0
  const chartData: any[] = []
  let rentInvestAsset = 0
  let rentCarryOver = 0
  const mir = (ret: number) => Math.pow(1 + ret / 100, 1 / 12) - 1

  for (let m = 1; m <= months; m++) {
    const year = Math.ceil(m / 12)
    const rate = getRate(year)
    const monthlyMir = mir(p.investReturn)

    // ─ 購入側 ─
    const remainMonths = totalLoanMonths - (m - 1)
    const payment = remainMonths > 0 ? mpmt(loanBalance, rate, remainMonths) : 0
    if (remainMonths > 0) {
      const interest = loanBalance * (rate / 100 / 12)
      loanBalance = Math.max(0, loanBalance - (payment - interest))
    }
    const mgmt = (year <= 5 ? p.mgmt1 : p.mgmt2) * 10000
    const mortgageDeductionAmt = year <= 13 ? Math.min(loanBalance * 0.007, 350000) : 0
    const annualNetTaxBenefit = mortgageDeductionAmt - p.fixedTax * 10000
    const isJune = m % 12 === 6
    const buyMonthlyCost = payment + mgmt

    if (isJune && year <= p.years) {
      buyInvestAsset = (buyInvestAsset + annualNetTaxBenefit) * (1 + monthlyMir)
    } else {
      buyInvestAsset *= (1 + monthlyMir)
    }
    // 頭金分の投資も複利運用
    downPaymentInvest *= (1 + monthlyMir)

    // ─ 賃貸側 ─
    const rentPeriod = Math.floor((m - 1) / 24)
    const rentMonthly = (p.rentStart + rentPeriod * p.rentHike) * 10000
    const isRenewal = m > 1 && (m - 1) % 24 === 0
    const renewalFeeAmt = isRenewal ? rentMonthly * p.renewalFee : 0
    const movingCostAmt = isRenewal ? p.movingCost * 10000 : 0   // 更新時に引越し費用
    const depositAmt = m === 1 ? (p.rentStart * 10000) * p.rentDeposit : 0
    const firstMoving = m === 1 ? p.movingCost * 10000 : 0       // 入居時引越し費用

    let investable = buyMonthlyCost - rentMonthly - depositAmt - renewalFeeAmt - movingCostAmt - firstMoving + rentCarryOver
    if (investable >= 0) {
      rentInvestAsset = rentInvestAsset * (1 + monthlyMir) + investable
      rentCarryOver = 0
    } else {
      rentInvestAsset = rentInvestAsset * (1 + monthlyMir)
      rentCarryOver = investable
    }

    const propertyValue = p.propertyPrice * 10000 * Math.pow(1 + p.finalPriceGrowthRate / 100, m / 12)
    const buyNetWorth = propertyValue - loanBalance + buyInvestAsset
    // ※頭金を入れた場合は頭金投資分は「購入をやめて賃貸にした場合」に賃貸側に加算

    chartData.push({
      month: m, year: m / 12,
      buyMonthlyPayment: Math.round(buyMonthlyCost / 10000),
      rentMonthly: Math.round(rentMonthly / 10000),
      buyLoanBalance: Math.round(loanBalance / 10000),
      buyInvestAsset: Math.round(buyInvestAsset / 10000),
      rentInvestAsset: Math.round(rentInvestAsset / 10000),
      buyNetWorth: Math.round(buyNetWorth / 10000),
      rentNetWorth: Math.round(rentInvestAsset / 10000),
      propertyValue: Math.round(propertyValue / 10000),
      loanBalance: Math.round(loanBalance / 10000),
    })
  }

  const finalPropertyValue = p.propertyPrice * 10000 * Math.pow(1 + p.finalPriceGrowthRate / 100, p.years)
  const sellCost = finalPropertyValue * (p.sellCostRate / 100)
  const finalLoanBalance = loanBalance
  // 取得費 = 物件価格 + 諸費用 + 頭金（頭金はすでに支払い済みなので取得費に含める）
  const acquisitionCost = p.propertyPrice * 10000 * (1 + 0.07)
  const profit = finalPropertyValue - acquisitionCost
  const taxableProfit = Math.max(0, profit - 30000000)
  const capitalGainsTax = taxableProfit > 0 ? taxableProfit * 0.20315 : 0

  const buyFinalNetWorth = finalPropertyValue - sellCost - finalLoanBalance - capitalGainsTax + buyInvestAsset
  const rentFinalNetWorth = rentInvestAsset

  function calcBuyAtPrice(sp: number): number {
    const sc = sp * (p.sellCostRate / 100)
    const pr = sp - acquisitionCost
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
  const loanAmount = Math.round(loanPrincipal / 10000)

  return {
    chartData,
    buyFinalNetWorth: Math.round(buyFinalNetWorth / 10000),
    rentFinalNetWorth: Math.round(rentFinalNetWorth / 10000),
    breakEvenPrice, breakEvenGrowthRate, breakEvenAnnualRate,
    finalLoanBalance: Math.round(finalLoanBalance / 10000),
    finalPropertyValue: Math.round(finalPropertyValue / 10000),
    buyInvestAsset: Math.round(buyInvestAsset / 10000),
    rentInvestAsset: Math.round(rentInvestAsset / 10000),
    loanAmount,
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
  years: 10, investReturn: 7, finalPriceGrowthRate: 0.43, sellCostRate: 4,
  propertyPrice: 14000, downPayment: 0, loanYears: 35,
  rate1: 1.5, rate2: 1.75, rate3: 2.0,
  mgmt1: 4, mgmt2: 6, fixedTax: 20,
  rentStart: 33, rentHike: 1.5, rentDeposit: 1, renewalFee: 1, movingCost: 25,
}

const GREEN = '#30d158'
const GRAY  = '#8e8e93'
const RED   = '#ff453a'
const BLUE  = '#0a84ff'

// ─────────────────────────────────────────
// Tooltips
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

const BreakdownTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const pv = payload.find((p: any) => p.dataKey === 'propertyValue')?.value ?? 0
  const lb = payload.find((p: any) => p.dataKey === 'loanBalance')?.value ?? 0
  return (
    <div style={{ background: '#2c2c2e', border: '1px solid #38383a', borderRadius: 10, padding: '8px 12px', fontSize: 12, minWidth: 150 }}>
      <p style={{ color: GRAY, marginBottom: 6 }}>{Number(label).toFixed(1)}年後</p>
      <p style={{ color: GREEN, margin: '2px 0' }}>物件価値：{fmt(pv)}円</p>
      <p style={{ color: RED,   margin: '2px 0' }}>ローン残：{fmt(lb)}円</p>
      <p style={{ color: '#fff', margin: '6px 0 0', paddingTop: 6, borderTop: '1px solid #38383a', fontWeight: 600 }}>
        純資産：{fmt(pv - lb)}円
      </p>
    </div>
  )
}

// ─────────────────────────────────────────
// UI パーツ
// ─────────────────────────────────────────
function SliderRow({ label, sub, value, min, max, step, unit, onChange, color }: {
  label: string; sub?: string; value: number; min: number; max: number; step: number
  unit?: string; onChange: (v: number) => void; color?: string
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const c = color ?? '#fff'
  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: sub ? 2 : 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: 15 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums' }}>
          {value.toLocaleString()}{unit}
        </span>
      </div>
      {sub && <p style={{ fontSize: 11, color: '#48484a', marginBottom: 8 }}>{sub}</p>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', background: `linear-gradient(to right, ${c} ${pct}%, #3a3a3c ${pct}%)` }}
      />
    </div>
  )
}

function SliderCell({ label, sub, value, min, max, step, unit, onChange, color, last }: {
  label: string; sub?: string; value: number; min: number; max: number; step: number
  unit?: string; onChange: (v: number) => void; color?: string; last?: boolean
}) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: last ? 'none' : '1px solid #2c2c2e' }}>
      <SliderRow label={label} sub={sub} value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} color={color} />
    </div>
  )
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 13, color: GRAY, letterSpacing: '0.02em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 8 }}>
        {title}
      </p>
      <div style={{ background: '#1c1c1e', borderRadius: 12, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

type SettingsTab = 'buy' | 'rent'

function SettingsTabPill({ active, onChange }: { active: SettingsTab; onChange: (t: SettingsTab) => void }) {
  return (
    <div style={{ display: 'flex', background: '#2c2c2e', borderRadius: 10, padding: 2, marginBottom: 24 }}>
      {([
        { key: 'buy' as const, label: '🏠 購入条件', color: GREEN },
        { key: 'rent' as const, label: '🔑 賃貸条件', color: BLUE },
      ]).map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          background: active === t.key ? '#1c1c1e' : 'transparent',
          color: active === t.key ? t.color : GRAY,
          transition: 'all 0.2s',
          boxShadow: active === t.key ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────
// メイン
// ─────────────────────────────────────────
type ResultTab = 'chart' | 'monthly' | 'breakdown'

export default function Home() {
  const [p, setP] = useState<Params>(DEFAULT)
  const [resultTab, setResultTab] = useState<ResultTab>('chart')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('buy')
  const [view, setView] = useState<'result' | 'settings'>('result')
  const [showInfo, setShowInfo] = useState(false)

  const set = (key: keyof Params) => (v: number) => setP(prev => ({ ...prev, [key]: v }))
  const r = useMemo(() => simulate(p), [p])
  const yearlyData = useMemo(() => r.chartData.filter((d: any) => d.month % 12 === 0), [r.chartData])

  const buyWins = r.buyFinalNetWorth >= r.rentFinalNetWorth
  const diff = Math.abs(r.buyFinalNetWorth - r.rentFinalNetWorth)
  const diffColor = buyWins ? GREEN : RED

  // 金利区間ラベル（シミュレーション期間を3等分）
  const seg = Math.ceil(p.years / 3)
  const rateLabels = [
    `1〜${seg}年目`,
    `${seg + 1}〜${seg * 2}年目`,
    `${seg * 2 + 1}〜${p.years}年目`,
  ]

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: '#000' }}>

      {/* ─── 前提条件モーダル ─── */}
      {showInfo && (
        <div onClick={() => setShowInfo(false)} style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 430, margin: '0 auto',
            background: '#1c1c1e', borderRadius: '20px 20px 0 0',
            maxHeight: '85dvh', overflowY: 'auto',
            paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          }}>
            <div style={{
              position: 'sticky', top: 0, background: '#1c1c1e',
              padding: '16px 20px 12px', borderBottom: '1px solid #2c2c2e',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>前提条件・ご注意</span>
              <button onClick={() => setShowInfo(false)} style={{
                width: 30, height: 30, borderRadius: '50%', background: '#3a3a3c', color: GRAY,
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
            <div style={{ padding: '20px 20px 32px' }}>
              <p style={{ fontSize: 11, color: GRAY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>計算ロジック</p>
              {[
                { title: 'ローン返済額', body: '元利均等返済方式。金利はシミュレーション期間を3等分した段階的変動金利を月次で適用。5年ルール・125%ルールは考慮しません。' },
                { title: '頭金と借入元本', body: '物件価格から頭金を差し引いた残額に諸費用7%を上乗せしたものが借入元本です。頭金を入れる場合、その分の機会コスト（投資に回した場合の複利成長）は現在のバージョンでは考慮していません。' },
                { title: '住宅ローン控除', body: '年末ローン残高 × 0.7%（上限35万円/年）を自動計算。ZEH住宅として13年間適用。固定資産税との差額がプラスの場合のみ年1回投資に回します。' },
                { title: '売却・譲渡税', body: '売却コストは売却価格の指定%。譲渡益から3,000万円特別控除を差し引いた残額に20.315%課税。' },
                { title: '賃貸側の投資', body: '購入側の月次コスト（ローン返済＋管理費）と賃貸コスト（家賃＋礼金・更新料・引越し費用）の差額を毎月インデックス投資に回します。NISA利用のため売却時非課税。' },
              ].map(item => (
                <div key={item.title} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #2c2c2e' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.75 }}>{item.body}</p>
                </div>
              ))}
              <p style={{ fontSize: 11, color: GRAY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, marginTop: 4 }}>用語説明</p>
              {[
                { term: '団体信用生命保険（団信）', desc: 'ローン返済中に死亡・高度障害になった場合、残債が全額免除される保険。本シミュレーターでは健康で生存する前提のため考慮外ですが、購入派の実質的なメリットの一つです。' },
                { term: '3,000万円特別控除', desc: 'マイホームを売却した際、譲渡益から3,000万円を差し引いて税金を計算できる特例。居住していた物件が対象。' },
                { term: 'ZEH（ゼッチ）', desc: 'Net Zero Energy House。断熱・省エネ・創エネにより年間の一次エネルギー消費量をゼロ以下にした住宅。住宅ローン控除の上限・期間が優遇されます。' },
                { term: '元利均等返済', desc: '毎月の返済額（元金＋利息）が一定になる返済方式。返済当初は利息比率が高く、後半になるにつれ元金比率が高まります。' },
              ].map(item => (
                <div key={item.term} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #2c2c2e' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{item.term}</p>
                  <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.75 }}>{item.desc}</p>
                </div>
              ))}
              <p style={{ fontSize: 11, color: GRAY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, marginTop: 4 }}>免責事項</p>
              <div style={{ background: '#2c2c2e', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, color: GRAY, lineHeight: 1.8 }}>
                  本シミュレーターは一般的な条件に基づく参考情報の提供を目的としており、特定の投資・購入判断を推奨するものではありません。金利・税制・不動産価格・株式市場は変動します。重要な意思決定は不動産業者・税理士・FP等の専門家にご相談ください。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ヘッダー ─── */}
      <div style={{
        padding: '56px 16px 0',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>購入 vs 賃貸</h1>
            <button onClick={() => setShowInfo(true)} style={{
              width: 24, height: 24, borderRadius: '50%', background: '#2c2c2e', color: GRAY,
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>ⓘ</button>
          </div>
          <button onClick={() => setView(v => v === 'result' ? 'settings' : 'result')} style={{
            background: '#2c2c2e', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 14, fontWeight: 500,
          }}>
            {view === 'result' ? '条件変更' : '結果を見る'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: GRAY, marginBottom: 12 }}>
          {(p.propertyPrice / 10000).toFixed(1)}億円 · 頭金{p.downPayment > 0 ? fmt(p.downPayment) + '円' : 'なし'} · {p.years}年
        </p>
        {view === 'result' && (
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #2c2c2e' }}>
            {([
              { k: 'chart' as const, l: '純資産' },
              { k: 'monthly' as const, l: '月次支出' },
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
                    <p style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.val)}円</p>
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

          {/* 純資産タブ */}
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

          {/* 月次支出タブ */}
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

          {/* 内訳タブ */}
          {resultTab === 'breakdown' && (
            <div style={{ paddingTop: 16 }}>
              <div style={{ padding: '0 16px 10px', display: 'flex', gap: 16 }}>
                {[{ c: GREEN, l: '物件価値' }, { c: RED, l: 'ローン残高' }].map(item => (
                  <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.c }} />
                    <span style={{ fontSize: 12, color: GRAY }}>{item.l}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 3, background: 'rgba(48,209,88,0.25)', borderRadius: 2 }} />
                  <span style={{ fontSize: 12, color: GRAY }}>純資産（差分）</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={yearlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GREEN} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={GREEN} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" stroke="#3a3a3c" tick={{ fontSize: 11, fill: GRAY }} tickFormatter={v => `${v}年`} tickLine={false} axisLine={false} />
                  <YAxis stroke="none" tick={false} width={0} />
                  <Tooltip content={<BreakdownTooltip />} />
                  <Area type="monotone" dataKey="loanBalance" stroke={RED} strokeWidth={2} strokeDasharray="5 3" fill="none" name="ローン残高" dot={false} />
                  <Area type="monotone" dataKey="propertyValue" stroke={GREEN} strokeWidth={2.5} fill="url(#netArea)" name="物件価値" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: '#48484a', textAlign: 'center', padding: '2px 16px 0' }}>
                緑線（物件価値）と赤点線（ローン残高）の差が純資産
              </p>
            </div>
          )}

          {/* 内訳リスト */}
          <div style={{ padding: '16px 16px 48px' }}>
            <Section title="購入側の内訳">
              <Row label="借入元本" value={`${fmt(r.loanAmount)}円`} />
              <Row label={`${p.years}年後ローン残高`} value={`${fmt(r.finalLoanBalance)}円`} />
              <Row label={`${p.years}年後物件価値`} value={`${fmt(r.finalPropertyValue)}円`} />
              <Row label="投資資産（控除差額）" value={`${fmt(r.buyInvestAsset)}円`} />
              <Row label="住宅ローン控除" value="年末残高×0.7%（自動）" color={GRAY} />
              <Row label="純資産" value={`${fmt(r.buyFinalNetWorth)}円`} color={GREEN} last />
            </Section>
            <Section title="賃貸側の内訳">
              <Row label="初期家賃" value={`${p.rentStart}万円/月`} />
              <Row label={`${p.years}年後の家賃（推定）`} value={`${p.rentStart + Math.floor(p.years / 2) * p.rentHike}万円/月`} />
              <Row label="引越しコスト" value={`${p.movingCost}万円/回`} />
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

          {/* ══ 共通設定（常に表示） ══ */}
          <Section title="共通設定">
            <SliderCell label="シミュレーション期間" value={p.years} min={5} max={20} step={1} unit="年" onChange={set('years')} />
            <SliderCell label="インデックス投資 年利" value={p.investReturn} min={2} max={15} step={0.5} unit="%" onChange={set('investReturn')} color={GREEN}
              sub="NISA利用・複利運用（購入・賃貸両方に適用）" />
            <SliderCell label="マンション価格上昇率（年率）" value={p.finalPriceGrowthRate} min={-3} max={5} step={0.1} unit="%/年"
              onChange={set('finalPriceGrowthRate')} color={p.finalPriceGrowthRate >= 0 ? GREEN : RED} />
            <SliderCell label="売却コスト" value={p.sellCostRate} min={2} max={8} step={0.5} unit="%" onChange={set('sellCostRate')}
              sub="仲介手数料など（購入・賃貸比較の共通前提）" last />
          </Section>

          {/* ══ 購入 / 賃貸タブ ══ */}
          <SettingsTabPill active={settingsTab} onChange={setSettingsTab} />

          {/* ─ 購入条件 ─ */}
          {settingsTab === 'buy' && (
            <>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${GREEN}, transparent)`, borderRadius: 2, marginBottom: 20 }} />

              <Section title="物件・頭金">
                <SliderCell label="物件価格" value={p.propertyPrice} min={5000} max={30000} step={500} unit="万円" onChange={set('propertyPrice')} color={GREEN} />
                <SliderCell label="頭金" value={p.downPayment} min={0} max={Math.round(p.propertyPrice * 0.3)} step={100} unit="万円"
                  onChange={set('downPayment')} sub={`借入元本：${fmt(Math.max(0, p.propertyPrice - p.downPayment + p.propertyPrice * 0.07))}円（諸費用7%込み）`} />
                <SliderCell label="ローン年数" value={p.loanYears} min={10} max={35} step={5} unit="年" onChange={set('loanYears')} last />
              </Section>

              <Section title="金利（変動・段階的上昇）">
                <SliderCell label={rateLabels[0]} value={p.rate1} min={0.1} max={3} step={0.05} unit="%" onChange={set('rate1')} />
                <SliderCell label={rateLabels[1]} value={p.rate2} min={0.1} max={3.5} step={0.05} unit="%" onChange={set('rate2')} />
                <SliderCell label={rateLabels[2]} value={p.rate3} min={0.1} max={4} step={0.05} unit="%" onChange={set('rate3')} last />
              </Section>

              <Section title="管理費・税金">
                <SliderCell label="管理費+修繕（1〜5年）" value={p.mgmt1} min={1} max={15} step={0.5} unit="万/月" onChange={set('mgmt1')} />
                <SliderCell label="管理費+修繕（6年〜）" value={p.mgmt2} min={1} max={20} step={0.5} unit="万/月" onChange={set('mgmt2')} />
                <SliderCell label="固定資産税" value={p.fixedTax} min={5} max={50} step={1} unit="万/年" onChange={set('fixedTax')} last />
              </Section>

              <div style={{ background: '#1c1c1e', borderRadius: 12, padding: '12px 16px', marginBottom: 28 }}>
                <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>住宅ローン控除（自動計算）</p>
                <p style={{ fontSize: 12, color: '#48484a', lineHeight: 1.7 }}>
                  年末ローン残高 × 0.7%（上限35万円）で自動計算。ZEH住宅・13年間適用。
                </p>
              </div>
            </>
          )}

          {/* ─ 賃貸条件 ─ */}
          {settingsTab === 'rent' && (
            <>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${BLUE}, transparent)`, borderRadius: 2, marginBottom: 20 }} />

              <Section title="家賃">
                <SliderCell label="初期家賃" value={p.rentStart} min={10} max={80} step={1} unit="万/月" onChange={set('rentStart')} color={BLUE} />
                <SliderCell label="2年ごとの家賃上昇" value={p.rentHike} min={0} max={5} step={0.5} unit="万円" onChange={set('rentHike')} last />
              </Section>

              <Section title="初期費用・更新・引越し">
                <SliderCell label="礼金" value={p.rentDeposit} min={0} max={3} step={0.5} unit="ヶ月" onChange={set('rentDeposit')} />
                <SliderCell label="更新料（2年ごと）" value={p.renewalFee} min={0} max={3} step={0.5} unit="ヶ月" onChange={set('renewalFee')} />
                <SliderCell label="引越し費用" value={p.movingCost} min={0} max={100} step={5} unit="万円"
                  onChange={set('movingCost')} sub="入居時 + 2年更新ごとに計上" last />
              </Section>
            </>
          )}

          <button onClick={() => setP(DEFAULT)} style={{
            width: '100%', background: '#1c1c1e', color: RED, borderRadius: 12, padding: '16px', fontSize: 16, fontWeight: 500, marginTop: 8,
          }}>
            デフォルトに戻す
          </button>
        </div>
      )}
    </div>
  )
}
