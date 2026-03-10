/**
 * Weekly Recap Notification
 *
 * NOTE: Scheduled local notifications work best in development/production builds.
 * In Expo Go, scheduled notifications may not fire reliably. Build with
 * `npx expo run:ios` or `eas build` to test scheduled notification behavior.
 */

import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

/**
 * Generate a weekly recap message summarizing the past 7 days of betting.
 */
export async function generateWeeklyRecapMessage(userId: string): Promise<string> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: weekBets } = await supabase
    .from('bets')
    .select('status, wager, potential_payout, placed_at')
    .eq('user_id', userId)
    .gte('placed_at', weekAgo.toISOString())

  if (!weekBets || weekBets.length === 0) {
    return "You didn't log any bets this week. Upload a slip to keep your streak alive!"
  }

  const settled = weekBets.filter(
    (b) => b.status === 'won' || b.status === 'lost'
  )
  const wins = settled.filter((b) => b.status === 'won').length
  const losses = settled.filter((b) => b.status === 'lost').length

  let profit = 0
  settled.forEach((b) => {
    if (b.status === 'won')
      profit += (b.potential_payout || 0) - (b.wager || 0)
    else if (b.status === 'lost') profit -= b.wager || 0
  })

  const record = `${wins}-${losses}`
  const profitStr =
    profit >= 0
      ? `+$${profit.toFixed(0)}`
      : `-$${Math.abs(profit).toFixed(0)}`

  // Compare to previous 12 weeks to find "best week in X months"
  let bestWeekCallout = ''
  if (profit > 0) {
    const twelveWeeksAgo = new Date(
      now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000
    )
    const { data: historicalBets } = await supabase
      .from('bets')
      .select('status, wager, potential_payout, placed_at')
      .eq('user_id', userId)
      .gte('placed_at', twelveWeeksAgo.toISOString())
      .lt('placed_at', weekAgo.toISOString())

    if (historicalBets && historicalBets.length > 0) {
      // Group historical bets into weeks and calculate profit per week
      const weeklyProfits: number[] = []
      for (let w = 1; w <= 11; w++) {
        const wStart = new Date(
          now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000
        )
        const wEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000)
        const weekGroup = historicalBets.filter((b) => {
          const d = new Date(b.placed_at)
          return d >= wStart && d < wEnd
        })
        let wProfit = 0
        weekGroup.forEach((b) => {
          if (b.status === 'won')
            wProfit += (b.potential_payout || 0) - (b.wager || 0)
          else if (b.status === 'lost') wProfit -= b.wager || 0
        })
        weeklyProfits.push(wProfit)
      }

      // Check if this week's profit is the best across all past weeks
      const nonEmptyWeeks = weeklyProfits.filter((p) => p !== 0)
      if (
        nonEmptyWeeks.length > 0 &&
        nonEmptyWeeks.every((p) => profit > p)
      ) {
        const months = Math.max(1, Math.ceil(nonEmptyWeeks.length / 4))
        bestWeekCallout = ` Your best week in ${months} month${months !== 1 ? 's' : ''}!`
      }
    }
  }

  if (profit >= 0) {
    return `Your week: ${record}, ${profitStr} 🔥${bestWeekCallout}`
  } else {
    return `Your week: ${record}, ${profitStr}. Tough stretch — check your Edge insights for patterns.`
  }
}

/**
 * Cancel any existing weekly recap notifications, then (if enabled)
 * schedule a new one for Sunday at 7 PM local time.
 *
 * Call this on every app open to keep the notification content fresh.
 */
export async function scheduleWeeklyRecap(userId: string): Promise<void> {
  try {
    // Always cancel existing weekly recap notifications first
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    for (const notif of scheduled) {
      if (
        notif.content.data &&
        (notif.content.data as Record<string, unknown>).type === 'weeklyRecap'
      ) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier)
      }
    }

    // Check notification permissions — fail silently if not granted
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.warn(
        '[WeeklyRecap] Push notification permissions not granted — skipping schedule'
      )
      return
    }

    // Check user's notification preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', userId)
      .single()

    if (profile?.notification_prefs?.push?.weeklyReport === false) {
      console.log('[WeeklyRecap] Weekly report disabled by user — skipping')
      return
    }

    // Generate the recap message with current data
    const message = await generateWeeklyRecapMessage(userId)

    // Schedule for Sunday at 7:00 PM local time
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Weekly Recap 📊',
        body: message,
        data: { type: 'weeklyRecap' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        weekday: 1, // Sunday in expo-notifications
        hour: 19,
        minute: 0,
        repeats: true,
      },
    })

    console.log('[WeeklyRecap] Scheduled for Sunday 7:00 PM')
  } catch (err) {
    console.warn('[WeeklyRecap] Failed to schedule notification:', err)
  }
}
