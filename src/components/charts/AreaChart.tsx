import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import ChartTooltip from './ChartTooltip'
import { CHART_COLORS } from '@/lib/constants'

interface Series {
  key: string
  label: string
  color?: string
}

interface AreaChartProps {
  data: Record<string, unknown>[]
  series: Series[]
  xKey?: string
  height?: number
  formatter?: (value: number, name: string) => string
  showLegend?: boolean
  /** Force whole-number y-axis ticks. For counts of things (visitors, posts)
   * the default auto-scale emits "0.5" / "1.5" whenever the range is small,
   * and half a visitor is not a quantity that exists. */
  integerYAxis?: boolean
}

export default function AreaChart({
  data,
  series,
  xKey = 'date',
  height = 240,
  formatter,
  showLegend = false,
  integerYAxis = false,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length]
            return (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            )
          })}
        </defs>
        <CartesianGrid
          strokeDasharray="0"
          vertical={false}
          stroke="rgba(226, 232, 240, 0.5)"
          strokeWidth={1}
        />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: '#707070' }}
          tickLine={false}
          axisLine={false}
          dy={8}
          interval="preserveStartEnd"
          tickCount={6}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#707070' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={!integerYAxis}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString())}
        />
        <Tooltip
          content={<ChartTooltip formatter={formatter} />}
          cursor={{ stroke: 'rgba(128, 158, 252, 0.2)', strokeWidth: 1 }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          />
        )}
        {series.map((s, i) => {
          const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length]
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )
        })}
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}
