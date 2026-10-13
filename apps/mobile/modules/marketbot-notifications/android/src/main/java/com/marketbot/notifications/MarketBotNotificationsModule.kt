package com.marketbot.notifications

import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MarketBotNotificationsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MarketBotNotifications")

    AsyncFunction("getSettings") {
      NotificationStorage(context()).settings.toMap()
    }

    AsyncFunction("setSettings") { value: Map<String, Boolean>, endpoint: String, token: String, spaceId: String ->
      val context = context()
      val storage = NotificationStorage(context)
      if (endpoint.isNotBlank() && !isAllowedNotificationEndpoint(endpoint)) {
        throw IllegalArgumentException("Public servers need https://. HTTP only works on your local network.")
      }
      storage.endpoint = endpoint
      storage.token = token
      storage.spaceId = spaceId
      storage.settings = NotificationSettings.fromMap(value)
      if (storage.settings.liveConnection && endpoint.isNotBlank() && token.isNotBlank()) {
        MarketBotNotificationService.start(context)
      } else {
        MarketBotNotificationService.stop(context)
      }
    }

    AsyncFunction("resume") { endpoint: String, token: String, spaceId: String ->
      val context = context()
      if (endpoint.isNotBlank() && !isAllowedNotificationEndpoint(endpoint)) {
        MarketBotNotificationService.stop(context)
      } else {
        val storage = NotificationStorage(context)
        storage.endpoint = endpoint
        storage.token = token
        storage.spaceId = spaceId
        if (storage.settings.liveConnection && endpoint.isNotBlank() && token.isNotBlank()) {
          MarketBotNotificationService.start(context)
        }
      }
    }

    AsyncFunction("stop") { clearSession: Boolean ->
      val context = context()
      if (clearSession) {
        MarketBotNotificationService.clearSession(context)
        val storage = NotificationStorage(context)
        storage.token = ""
        storage.spaceId = ""
      } else {
        MarketBotNotificationService.stop(context)
      }
    }

    AsyncFunction("setOpenThread") { botId: String?, threadId: String? ->
      MarketBotNotificationService.setOpenThread(context(), botId, threadId)
    }

    AsyncFunction("openSettings") {
      val context = context()
      context.startActivity(
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    AsyncFunction("canPostPromotedNotifications") {
      if (Build.VERSION.SDK_INT < 36) {
        true
      } else {
        val manager = context().getSystemService(NotificationManager::class.java)
        runCatching {
          manager.javaClass.getMethod("canPostPromotedNotifications").invoke(manager) as Boolean
        }.getOrDefault(false)
      }
    }

    AsyncFunction("openPromotedSettings") {
      val context = context()
      val promoted = Intent("android.settings.APP_NOTIFICATION_PROMOTION_SETTINGS")
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { context.startActivity(promoted) }.getOrElse {
        context.startActivity(
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }
  }

  private fun context() = appContext.reactContext
    ?: throw IllegalStateException("Android application context is unavailable")
}
