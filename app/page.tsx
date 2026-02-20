'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'

// ============================================================
// 型定義
// ============================================================
interface Params {
  propertyPrice: number        // 物件価格（万円）
  downPaymentRate: number      // 諸費用率（%）
  loanYears: number            // ローン年数
  rate1: number                // 金利 1-3年（%）
  rate2: number                // 金利 4-6年（%）
  rate3: number                // 金利 7年以降（%）
  mgmt1: number                // 管理費+修繕 1-5年（万円/月）
  mgmt2: number                // 管理費+修繕 6-10年（万円/月）
  fixedTax: number             // 固定資産税（万円/年）
  mortgageDeduction: number    // 住宅ローン控除（万円/年）
  sellCostRate: number         // 売却コスト（%）
  // 賃貸側
  rentStart: number            // 初期家賃（万円/月）
  rentHike: number             // 2年ごと家賃上昇（万円）
  rentDeposit: number          // 礼金（月数）
  renewalFee: number           // 更新料（月数）
  // 投資
  investReturn: number         // 年間投資利回り（%）
  // シミュレーション
  years: number                // シミュレーション期間（年）
  finalPriceGrowthRate: number // 売却価格上昇率（%/年）
}

// ============================================================
// シミュレーションエンジン
// ============================================================
function simulate(p: Params) {
  const months = p.years * 12
  const principal = p.propertyPrice * 10000 * (1 + p.downPaymentRate / 100)

  // 月次ローン返済額計算（元利均等）
  function monthlyPayment(balance: number, annualRate: number, remainingMonths: number): number {
    const r = annualRate / 100 / 12
    if (r === 0) return balance / remainingMonths
    return balance * r * Math.pow(1 + r, remainingMonths) / (Math.pow(1 + r, remainingMonths) - 1)
  }

  // --- 購入側 ---
  let loanBalance = principal
  const totalLoanMonths = p.loanYears * 12
  let buyTotalCost = 0 // 購入側が払った合計（ローン返済+管理費+税-控除）
  let buyInvestAsset = 0 // 購入側の投資資産（年税差額）

  const chartData: Array<{
    month: number
    year: number
    buyMonthlyPayment: number
    rentMonthly: number
    buyLoanBalance: number
    buyInvestAsset: number
    rentInvestAsset: number
    buyNetWorth: number   // 物件評価（仮）- ローン残 + 投資
    rentNetWorth: number  // 投資資産のみ
  }> = []

  let rentInvestAsset = 0
  let rentAccumCost = 0
  let rentCarryOver = 0 // 礼金・更新料で投資できなかった分の繰越

  for (let m = 1; m <= months; m++) {
    const year = Math.ceil(m / 12)

    // 金利決定
    let rate = p.rate3
    if (year <= 3) rate = p.rate1
    else if (year <= 6) rate = p.rate2

    // ローン残り月数
    const remainMonths = totalLoanMonths - (m - 1)
    const payment = remainMonths > 0 ? monthlyPayment(loanBalance, rate, remainMonths) : 0

    // ローン残高更新
    if (remainMonths > 0) {
      const monthlyRate = rate / 100 / 12
      const interest = loanBalance * monthlyRate
      const repayPrincipal = payment - interest
      loanBalance = Math.max(0, loanBalance - repayPrincipal)
    }

    // 管理費
    const mgmt = (year <= 5 ? p.mgmt1 : p.mgmt2) * 10000

    // 固定資産税・控除（年1回6月=6ヶ月目相殺）
    const annualNetTaxBenefit = (p.mortgageDeduction - p.fixedTax) * 10000
    const isJune = m % 12 === 6

    // 購入側月次コスト
    const buyMonthlyCost = payment + mgmt
    buyTotalCost += buyMonthlyCost

    // 購入側：税控除差額を投資（年1回）
    if (isJune && year <= 10) {
      const monthlyInvestReturn = Math.pow(1 + p.investReturn / 100, 1 / 12) - 1
      buyInvestAsset = (buyInvestAsset + annualNetTaxBenefit) * (1 + monthlyInvestReturn)
    } else {
      const monthlyInvestReturn = Math.pow(1 + p.investReturn / 100, 1 / 12) - 1
      buyInvestAsset *= (1 + monthlyInvestReturn)
    }

    // --- 賃貸側 ---
    // 家賃：2年ごとに+rentHike万円（0,2,4,6,8年後に改定）
    const rentPeriod = Math.floor((m - 1) / 24) // 0始まり
    const rentMonthly = (p.rentStart + rentPeriod * p.rentHike) * 10000

    // 礼金（最初の月）
    const isRentStart = m === 1
    // 更新料（24ヶ月ごと、m=25,49,73,97,121...）
    const isRenewal = m > 1 && (m - 1) % 24 === 0
    const renewalFeeAmount = isRenewal ? rentMonthly * p.renewalFee : 0
    const depositAmount = isRentStart ? (p.rentStart * 10000) * p.rentDeposit : 0

    // 投資可能額 = 購入コスト - 賃料 - 礼金/更新料 + 繰越
    const monthlyInvestReturn = Math.pow(1 + p.investReturn / 100, 1 / 12) - 1
    let investable = buyMonthlyCost - rentMonthly - depositAmount - renewalFeeAmount + rentCarryOver

    if (investable >= 0) {
      rentInvestAsset = (rentInvestAsset * (1 + monthlyInvestReturn)) + investable
      rentCarryOver = 0
    } else {
      rentInvestAsset = rentInvestAsset * (1 + monthlyInvestReturn)
      rentCarryOver = investable // 負値を次月に繰越
    }

    rentAccumCost += rentMonthly + depositAmount + renewalFeeAmount

    // 物件評価（線形成長）
    const propertyValue = p.propertyPrice * 10000 * Math.pow(1 + p.finalPriceGrowthRate / 100, m / 12)

    chartData.push({
      month: m,
      year: m / 12,
      buyMonthlyPayment: Math.round(buyMonthlyCost / 10000),
      rentMonthly: Math.round(rentMonthly / 10000),
      buyLoanBalance: Math.round(loanBalance / 10000),
      buyInvestAsset: Math.round(buyInvestAsset / 10000),
      rentInvestAsset: Math.round(rentInvestAsset / 10000),
      buyNetWorth: Math.round((propertyValue - loanBalance + buyInvestAsset) / 10000),
      rentNetWorth: Math.round(rentInvestAsset / 10000),
    })
  }

  // 10年後売却計算
  const finalPropertyValue = p.propertyPrice * 10000 * Math.pow(1 + p.finalPriceGrowthRate / 100, p.years)
  const sellCost = finalPropertyValue * (p.sellCostRate / 100)
  const finalLoanBalance = loanBalance
  // 譲渡益
  const profit = finalPropertyValue - p.propertyPrice * 10000 * (1 + p.downPaymentRate / 100)
  const taxableProfit = Math.max(0, profit - 30000000) // 3000万特別控除
  const capitalGainsTax = taxableProfit > 0 ? taxableProfit * 0.20315 : 0 // 軽減税率

  const buyFinalNetWorth = finalPropertyValue - sellCost - finalLoanBalance - capitalGainsTax + buyInvestAsset
  const rentFinalNetWorth = rentInvestAsset

  // 損益分岐点（何%上昇なら購入が有利か）計算
  // 購入が有利 ⟺ buyFinalNetWorth >= rentFinalNetWorth
  // 物件売却価格をXとして解く（近似）
  function calcBuyNetWorthAtPrice(sellPrice: number): number {
    const sc = sellPrice * (p.sellCostRate / 100)
    const pr = sellPrice - p.propertyPrice * 10000 * (1 + p.downPaymentRate / 100)
    const taxP = Math.max(0, pr - 30000000) * 0.20315
    return sellPrice - sc - finalLoanBalance - taxP + buyInvestAsset
  }

  // 二分探索で損益分岐売却価格を求める
  let lo = 0, hi = p.propertyPrice * 10000 * 3
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (calcBuyNetWorthAtPrice(mid) < rentFinalNetWorth) lo = mid
    else hi = mid
  }
  const breakEvenPrice = Math.round((lo + hi) / 2 / 10000)
  const breakEvenGrowthRate = ((breakEvenPrice / p.propertyPrice - 1) * 100)
  const breakEvenAnnualRate = (Math.pow(1 + breakEvenGrowthRate / 100, 1 / p.years) - 1) * 100

  return {
    chartData,
    buyFinalNetWorth: Math.round(buyFinalNetWorth / 10000),
    rentFinalNetWorth: Math.round(rentFinalNetWorth / 10000),
    breakEvenPrice,
    breakEvenGrowthRate,
    breakEvenAnnualRate,
    finalLoanBalance: Math.round(finalLoanBalance / 10000),
    finalPropertyValue: Math.round(finalPropertyValue / 10000),
    buyInvestAsset: Math.round(buyInvestAsset / 10000),
    rentInvestAsset: Math.round(rentInvestAsset / 10000),
  }
}

// ============================================================
// フォーマットユーティリティ
// ============================================================
function fmt(n: number): string {
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}億円`
  return `${n.toLocaleString()}万円`
}

function fmtM(n: number): string {
  return `${n.toLocaleString()}万円`
}

// ============================================================
// コンポーネント
// ============================================================

function SliderInput({
  label, value, min, max, step, unit, onChange, description
}: {
  label: string; value: number; min: number; max: number; step: number
  unit?: string; onChange: (v: number) => void; description?: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{label}</label>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}>
          {value.toLocaleString()}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 2 }}
      />
      {description && (
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{description}</p>
      )}
    </div>
  )
}

function NumberInput({ label, value, unit, onChange }: {
  label: string; value: number; unit?: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        {unit && <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{unit}</span>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        fontFamily: 'DM Mono, monospace'
      }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{`${Number(label).toFixed(1)}年後`}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>
            {p.name}: {fmtM(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

const DEFAULT_PARAMS: Params = {
  propertyPrice: 14000,
  downPaymentRate: 7,
  loanYears: 35,
  rate1: 1.5,
  rate2: 1.75,
  rate3: 2.0,
  mgmt1: 4,
  mgmt2: 6,
  fixedTax: 20,
  mortgageDeduction: 31.5,
  sellCostRate: 4,
  rentStart: 33,
  rentHike: 1.5,
  rentDeposit: 1,
  renewalFee: 1,
  investReturn: 7,
  years: 10,
  finalPriceGrowthRate: 0.43,
}

export default function Home() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [activeTab, setActiveTab] = useState<'chart' | 'monthly' | 'breakdown'>('chart')

  const set = (key: keyof Params) => (v: number) => setParams(p => ({ ...p, [key]: v }))

  const result = useMemo(() => simulate(params), [params])

  const yearlyData = useMemo(() => {
    return result.chartData.filter(d => d.month % 12 === 0)
  }, [result.chartData])

  const buyWins = result.buyFinalNetWorth >= result.rentFinalNetWorth
  const diff = Math.abs(result.buyFinalNetWorth - result.rentFinalNetWorth)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <header style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-block',
          background: 'linear-gradient(135deg, var(--accent) 0%, #ff9f43 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: 'Noto Serif JP, serif',
          fontSize: 'clamp(22px, 4vw, 36px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          marginBottom: 12
        }}>
          マンション購入 vs 賃貸＋投資
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, letterSpacing: '0.05em' }}>
          東京23区 1.4億円マンション ・ 10年間シミュレーター
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* === LEFT: CONTROLS === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* 購入側 */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px 20px 12px',
          }}>
            <h3 style={{
              fontSize: 11, letterSpacing: '0.12em', color: 'var(--buy-color)',
              marginBottom: 16, textTransform: 'uppercase', fontWeight: 700
            }}>🏠 購入側の条件</h3>

            <SliderInput label="物件価格" value={params.propertyPrice} min={5000} max={30000} step={500}
              unit="万円" onChange={set('propertyPrice')} />
            <SliderInput label="諸費用率" value={params.downPaymentRate} min={3} max={12} step={0.5}
              unit="%" onChange={set('downPaymentRate')} description="オーバーローンに上乗せ" />
            <SliderInput label="ローン年数" value={params.loanYears} min={10} max={35} step={5}
              unit="年" onChange={set('loanYears')} />
            
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, letterSpacing: '0.06em' }}>金利（段階的上昇）</p>
              <SliderInput label="1〜3年目" value={params.rate1} min={0.5} max={3} step={0.05} unit="%" onChange={set('rate1')} />
              <SliderInput label="4〜6年目" value={params.rate2} min={0.5} max={3.5} step={0.05} unit="%" onChange={set('rate2')} />
              <SliderInput label="7年目以降" value={params.rate3} min={0.5} max={4} step={0.05} unit="%" onChange={set('rate3')} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, letterSpacing: '0.06em' }}>管理費＋修繕積立金</p>
              <SliderInput label="1〜5年目" value={params.mgmt1} min={1} max={15} step={0.5} unit="万/月" onChange={set('mgmt1')} />
              <SliderInput label="6〜10年目" value={params.mgmt2} min={1} max={20} step={0.5} unit="万/月" onChange={set('mgmt2')} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <SliderInput label="固定資産税（年）" value={params.fixedTax} min={5} max={50} step={1} unit="万円" onChange={set('fixedTax')} />
              <SliderInput label="住宅ローン控除（年）" value={params.mortgageDeduction} min={0} max={60} step={0.5} unit="万円" onChange={set('mortgageDeduction')} />
              <SliderInput label="売却コスト" value={params.sellCostRate} min={2} max={8} step={0.5} unit="%" onChange={set('sellCostRate')} />
            </div>
          </section>

          {/* 賃貸側 */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px 20px 12px',
          }}>
            <h3 style={{
              fontSize: 11, letterSpacing: '0.12em', color: 'var(--rent-color)',
              marginBottom: 16, textTransform: 'uppercase', fontWeight: 700
            }}>🔑 賃貸側の条件</h3>

            <SliderInput label="初期家賃" value={params.rentStart} min={10} max={80} step={1} unit="万/月" onChange={set('rentStart')} />
            <SliderInput label="2年ごとの家賃上昇" value={params.rentHike} min={0} max={5} step={0.5} unit="万円" onChange={set('rentHike')} />
            <SliderInput label="礼金" value={params.rentDeposit} min={0} max={3} step={0.5} unit="ヶ月" onChange={set('rentDeposit')} />
            <SliderInput label="更新料" value={params.renewalFee} min={0} max={3} step={0.5} unit="ヶ月" onChange={set('renewalFee')} />
          </section>

          {/* 投資・その他 */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px 20px 12px',
          }}>
            <h3 style={{
              fontSize: 11, letterSpacing: '0.12em', color: 'var(--accent)',
              marginBottom: 16, textTransform: 'uppercase', fontWeight: 700
            }}>📈 投資・シミュレーション</h3>

            <SliderInput label="インデックス投資 年利" value={params.investReturn} min={2} max={15} step={0.5}
              unit="%" onChange={set('investReturn')} description="NISA利用・複利運用" />
            <SliderInput label="シミュレーション期間" value={params.years} min={5} max={20} step={1}
              unit="年" onChange={set('years')} />
            <SliderInput label="10年後のマンション価格上昇率（年率）" value={params.finalPriceGrowthRate}
              min={-3} max={5} step={0.1} unit="%/年" onChange={set('finalPriceGrowthRate')} />
          </section>
        </div>

        {/* === RIGHT: RESULTS === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* 結果サマリー */}
          <div style={{
            background: 'var(--surface)',
            border: `2px solid ${buyWins ? 'var(--buy-color)' : 'var(--rent-color)'}`,
            borderRadius: 16,
            padding: '28px 28px 24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: buyWins
                ? 'linear-gradient(90deg, var(--buy-color), #ff9f43)'
                : 'linear-gradient(90deg, var(--rent-color), #a78bfa)'
            }} />

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.08em' }}>
              {params.years}年後の結果
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <span style={{
                fontFamily: 'Noto Serif JP, serif',
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 700,
                color: buyWins ? 'var(--buy-color)' : 'var(--rent-color)'
              }}>
                {buyWins ? '🏠 購入が有利' : '🔑 賃貸＋投資が有利'}
              </span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: 'var(--text-muted)' }}>
                差 {fmtM(diff)}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginTop: 20,
              paddingTop: 20,
              borderTop: '1px solid var(--border)'
            }}>
              {[
                { label: '購入側 純資産', value: result.buyFinalNetWorth, color: 'var(--buy-color)' },
                { label: '賃貸側 投資資産', value: result.rentFinalNetWorth, color: 'var(--rent-color)' },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{item.label}</p>
                  <p style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 'clamp(16px, 2.5vw, 22px)',
                    fontWeight: 500,
                    color: item.color
                  }}>
                    {fmt(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 損益分岐点 */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px 24px',
          }}>
            <p style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 12, fontWeight: 700 }}>
              ⚖️ 損益分岐点（購入が有利になるライン）
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: '必要売却価格', value: fmtM(result.breakEvenPrice) },
                { label: '総上昇率', value: `${result.breakEvenGrowthRate.toFixed(2)}%` },
                { label: '年率換算', value: `${result.breakEvenAnnualRate.toFixed(2)}%/年` },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  padding: '12px 14px',
                }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em' }}>{item.label}</p>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, color: 'var(--accent)', fontWeight: 500 }}>{item.value}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
              {params.years}年後の売却価格が
              <span style={{ color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}> {fmtM(result.breakEvenPrice)} </span>
              を上回れば購入が有利。現在の設定では
              <span style={{ color: buyWins ? 'var(--buy-color)' : 'var(--rent-color)', fontWeight: 700 }}>
                {buyWins ? ' 購入が有利 ' : ' 賃貸が有利 '}
              </span>
              な条件です。
            </p>
          </div>

          {/* タブ付きチャート */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {([
                { key: 'chart', label: '純資産推移' },
                { key: 'monthly', label: '月次支出比較' },
                { key: 'breakdown', label: '詳細内訳' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    background: activeTab === tab.key ? 'var(--surface2)' : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    color: activeTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: 12,
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px 16px' }}>
              {activeTab === 'chart' && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                    購入側：物件評価額 − ローン残高 ＋ 投資資産　/　賃貸側：投資資産のみ
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={yearlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11}
                        tickFormatter={v => `${v}年`} />
                      <YAxis stroke="var(--text-muted)" fontSize={11}
                        tickFormatter={v => `${(v / 10000).toFixed(1)}億`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={0} stroke="var(--text-dim)" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="buyNetWorth" stroke="var(--buy-color)"
                        strokeWidth={2.5} dot={false} name="購入 純資産" />
                      <Line type="monotone" dataKey="rentNetWorth" stroke="var(--rent-color)"
                        strokeWidth={2.5} dot={false} name="賃貸 投資資産" />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}

              {activeTab === 'monthly' && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                    毎月の出費比較（購入：ローン返済+管理費　/　賃貸：家賃）
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={yearlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${v}年`} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${v}万`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="buyMonthlyPayment" stroke="var(--buy-color)"
                        strokeWidth={2.5} dot={false} name="購入 月次コスト（万）" />
                      <Line type="monotone" dataKey="rentMonthly" stroke="var(--rent-color)"
                        strokeWidth={2.5} dot={false} name="賃貸 家賃（万）" />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}

              {activeTab === 'breakdown' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    {
                      title: '🏠 購入側', color: 'var(--buy-color)',
                      items: [
                        { label: 'ローン借入元本', value: fmtM(Math.round(params.propertyPrice * (1 + params.downPaymentRate / 100))) },
                        { label: `${params.years}年後ローン残高`, value: fmtM(result.finalLoanBalance) },
                        { label: `${params.years}年後物件価値`, value: fmtM(result.finalPropertyValue) },
                        { label: '投資資産（税控除差額）', value: fmtM(result.buyInvestAsset) },
                        { label: '純資産合計', value: fmt(result.buyFinalNetWorth), highlight: true },
                      ]
                    },
                    {
                      title: '🔑 賃貸側', color: 'var(--rent-color)',
                      items: [
                        { label: '初期家賃', value: `${params.rentStart}万/月` },
                        { label: `${params.years}年後の家賃`, value: `${params.rentStart + Math.floor(params.years / 2) * params.rentHike}万/月（推定）` },
                        { label: '投資資産（差額積立）', value: fmtM(result.rentInvestAsset) },
                        { label: '純資産合計', value: fmt(result.rentFinalNetWorth), highlight: true },
                      ]
                    }
                  ].map(section => (
                    <div key={section.title} style={{
                      background: 'var(--surface2)',
                      borderRadius: 10,
                      padding: '16px',
                      border: `1px solid ${section.color}22`
                    }}>
                      <p style={{ fontSize: 12, color: section.color, fontWeight: 700, marginBottom: 14 }}>{section.title}</p>
                      {section.items.map(item => (
                        <div key={item.label} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          marginBottom: 10,
                          paddingTop: item.highlight ? 10 : 0,
                          borderTop: item.highlight ? '1px solid var(--border)' : 'none'
                        }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</span>
                          <span style={{
                            fontFamily: 'DM Mono, monospace',
                            fontSize: item.highlight ? 15 : 13,
                            color: item.highlight ? section.color : 'var(--text)',
                            fontWeight: item.highlight ? 700 : 400
                          }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 注意事項 */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 18px',
          }}>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              ⚠️ このシミュレーターは参考目的のみです。実際の運用結果を保証するものではありません。
              税制や金利は変動します。重要な意思決定には専門家への相談をおすすめします。
              投資には元本割れリスクがあります。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
