import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

export interface ForecastDataPoint {
  date: string
  actual: number | null
  base: number | null
  optimistic: number | null
  pessimistic: number | null
}

interface Props {
  data: ForecastDataPoint[]
  boundaryDate: string // first forecast date (ISO)
  height?: number
}

const fmt = (d: string) => {
  try {
    const [, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(m) - 1]} ${parseInt(day)}`
  } catch { return d }
}

interface TooltipEntry {
  dataKey?: string | number
  value?: number | null
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null
  const byKey: Record<string, number | null | undefined> = Object.fromEntries(
    payload.map((p) => [String(p.dataKey), p.value])
  )
  const isHistory = byKey.actual != null

  return (
    <div className="bg-white dark:bg-gray-900 border border-border rounded-lg p-3 shadow-card text-xs">
      <p className="font-medium text-text-primary mb-1">{fmt(label ?? '')}</p>
      {isHistory ? (
        <p className="text-[#0129AC]">Actual: <span className="font-semibold">{byKey.actual?.toLocaleString()}</span></p>
      ) : (
        <>
          <p className="text-[#0129AC]">Base: <span className="font-semibold">{byKey.base?.toLocaleString()}</span></p>
          <p className="text-emerald-600">Optimistic: <span className="font-semibold">{byKey.optimistic?.toLocaleString()}</span></p>
          <p className="text-amber-600">Pessimistic: <span className="font-semibold">{byKey.pessimistic?.toLocaleString()}</span></p>
        </>
      )}
    </div>
  )
}

export default function ForecastChart({ data, boundaryDate, height = 260 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0129AC" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0129AC" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#809EFC" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#809EFC" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: '#707070' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={36}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#707070' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
          width={42}
        />
        <Tooltip content={<CustomTooltip />} />
        {/* Confidence band — optimistic fill down to pessimistic */}
        <Area
          dataKey="optimistic"
          stroke="none"
          fill="url(#bandGrad)"
          fillOpacity={1}
          isAnimationActive={false}
        />
        <Area
          dataKey="pessimistic"
          stroke="none"
          fill="#FAFBFE"
          fillOpacity={1}
          isAnimationActive={false}
        />
        {/* Historical actual */}
        <Area
          dataKey="actual"
          stroke="#0129AC"
          strokeWidth={2}
          fill="url(#actualGrad)"
          dot={false}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
        {/* Forecast centerline */}
        <Line
          dataKey="base"
          stroke="#809EFC"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={false}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
        <ReferenceLine
          x={boundaryDate}
          stroke="#E2E8F0"
          strokeDasharray="4 2"
          label={{ value: 'Forecast', position: 'insideTopRight', fontSize: 10, fill: '#707070' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
