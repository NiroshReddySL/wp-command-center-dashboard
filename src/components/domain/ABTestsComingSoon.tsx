import { FlaskConical, PenLine, Split, BarChart3, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const STEPS = [
  {
    icon: PenLine,
    title: 'Create variants',
    description:
      'Pick any post or landing page — Autopilot’s AI drafts 2–3 alternative titles and meta descriptions to challenge the original.',
  },
  {
    icon: Split,
    title: 'Split traffic',
    description:
      'The WP Command Center plugin serves each variant to a share of visitors (e.g. a 50/50 split) — no code changes on your site.',
  },
  {
    icon: BarChart3,
    title: 'Measure real results',
    description:
      'Impressions and click-through rate are tracked per variant from Google Search Console and GA4 — real searches, not synthetic tests.',
  },
  {
    icon: Trophy,
    title: 'Auto-apply the winner',
    description:
      'When a variant reaches 95% statistical confidence, Autopilot declares the winner. Apply it with one click — or let Autopilot publish it for you.',
  },
]

/** Placeholder for the A/B testing engine — explains the planned feature. */
export default function ABTestsComingSoon() {
  return (
    <Card className="p-8">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-surface dark:bg-surface-dark text-primary dark:text-primary-dark">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-text-primary dark:text-text-primary-dark">
              A/B Testing
            </h3>
            <Badge variant="info">Coming soon</Badge>
          </div>
          <p className="text-[13px] text-text-secondary dark:text-text-secondary-dark mt-1 max-w-2xl">
            Run controlled title and meta-description experiments on your WordPress pages, measure
            real search click-through per variant, and automatically roll out the winner.
          </p>
        </div>
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark mb-3">
        How it will work
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STEPS.map((step, i) => (
          <div key={step.title}
            className="flex gap-3 rounded-lg border border-border dark:border-border-dark p-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface dark:bg-surface-dark text-primary dark:text-primary-dark">
              <step.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
                {i + 1}. {step.title}
              </p>
              <p className="text-[12px] text-text-secondary dark:text-text-secondary-dark mt-0.5 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark rounded-md p-3 mt-5">
        Variant serving requires an update to the WP Command Center WordPress plugin, which is under
        development. Until then, the Optimizer’s content analysis already suggests improved titles
        and meta descriptions you can apply manually.
      </p>
    </Card>
  )
}
