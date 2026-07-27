import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparkLineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export default function SparkLine({ data, color = '#0129AC', width = 80, height = 28 }: SparkLineProps) {
  const chartData = data.map((value, index) => ({ index, value }))

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
