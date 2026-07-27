import { useEffect, useState } from 'react'
import { CheckCircle, Send } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useNotificationPrefs, useSaveNotificationPrefs, useTestTeamsWebhook } from '@/hooks/useSettings'

function apiErrorDetail(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback
}

/** MS Teams webhook + alert/digest preferences — persisted server-side. */
export default function NotificationPrefsCard() {
  const { data: saved } = useNotificationPrefs()
  const save = useSaveNotificationPrefs()
  const test = useTestTeamsWebhook()

  const [webhookUrl, setWebhookUrl] = useState('')
  const [notifyCritical, setNotifyCritical] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)

  useEffect(() => {
    if (saved) {
      setWebhookUrl(saved.teams_webhook_url)
      setNotifyCritical(saved.notify_critical)
      setWeeklyDigest(saved.weekly_digest)
    }
  }, [saved])

  const handleSave = () =>
    save.mutate({
      teams_webhook_url: webhookUrl.trim(),
      notify_critical: notifyCritical,
      weekly_digest: weeklyDigest,
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <span className="text-[11px] text-text-secondary dark:text-text-secondary-dark">Microsoft Teams</span>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="notify-critical" checked={notifyCritical}
              onChange={(e) => setNotifyCritical(e.target.checked)} className="h-4 w-4 accent-primary" />
            <label htmlFor="notify-critical" className="text-[13px] text-text-primary dark:text-text-primary-dark">
              Post critical alerts to Teams
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="notify-weekly" checked={weeklyDigest}
              onChange={(e) => setWeeklyDigest(e.target.checked)} className="h-4 w-4 accent-primary" />
            <label htmlFor="notify-weekly" className="text-[13px] text-text-primary dark:text-text-primary-dark">
              Post the weekly report digest to Teams
            </label>
          </div>
          <Input label="MS Teams Webhook URL" placeholder="https://prod-xx.westus.logic.azure.com/workflows/..."
            value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
          <p className="text-[11px] text-text-secondary dark:text-text-secondary-dark bg-surface dark:bg-surface-dark rounded-md p-3">
            In Teams: channel <span className="font-medium">⋯ menu → Workflows → “Post to a channel when a
            webhook request is received”</span>, then paste the generated URL here. Alerts arrive as Adaptive Cards.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" loading={save.isPending} onClick={handleSave}>
              Save
            </Button>
            <Button variant="secondary" size="sm" loading={test.isPending}
              onClick={() => test.mutate()} className="flex items-center gap-1.5">
              <Send className="h-3 w-3" /> Send test message
            </Button>
            {save.isSuccess && !save.isPending && (
              <span className="text-[11px] text-success flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Saved
              </span>
            )}
            {test.isSuccess && !test.isPending && (
              <span className="text-[11px] text-success flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Test sent — check the channel
              </span>
            )}
          </div>
          {save.isError && (
            <p className="text-[11px] text-danger">{apiErrorDetail(save.error, 'Couldn’t save preferences.')}</p>
          )}
          {test.isError && (
            <p className="text-[11px] text-danger">{apiErrorDetail(test.error, 'Test message failed.')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
