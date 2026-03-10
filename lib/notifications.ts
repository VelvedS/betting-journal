import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerPushToken(userId: string): Promise<void> {
  // Physical device only — simulators can't receive push notifications
  if (!Device.isDevice) {
    console.log('[Push] Skipping registration — not a physical device')
    return
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied')
    return
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ledgr Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2DC672',
    })
  }

  // Get Expo push token
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

  let token: string
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    })
    token = tokenData.data
  } catch (e) {
    console.warn('[Push] Push notifications not available — projectId not configured')
    return
  }
  console.log('[Push] Token registered:', token)

  // Save to profiles table
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, push_token: token })

  if (error) {
    console.error('[Push] Failed to save token:', error)
  }
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: data ?? {},
  }

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })
}
