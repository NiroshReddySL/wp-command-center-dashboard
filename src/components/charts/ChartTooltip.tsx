interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>
  label?: string
  formatter?: (value: number, name: string) => string
}

export default function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg shadow-dropdown p-3 min-w-[140px]">
      {label && (
        <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark mb-2 pb-2 border-b border-border dark:border-border-dark">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">{item.name}</span>
            </div>
            <span className="text-[12px] font-semibold text-text-primary dark:text-text-primary-dark">
              {formatter ? formatter(item.value, item.name) : item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
