import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import ChartTooltip from './ChartTooltip'
import { CHART_COLORS } from '@/lib/constants'

interface BarChartProps {
  data: Record<string, unknown>[]
  bars: Array<{ key: string; label: string; color?: string }>
  xKey?: string
  height?: number
  formatter?: (value: number, name: string) => string
}

export default function BarChart({ data, bars, xKey = 'name', height = 200, formatter }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#707070' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={<ChartTooltip formatter={formatter} />}
          cursor={{ fill: 'rgba(128, 158, 252, 0.06)' }}
        />
        {bars.map((bar, i) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.label}
            fill={bar.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
