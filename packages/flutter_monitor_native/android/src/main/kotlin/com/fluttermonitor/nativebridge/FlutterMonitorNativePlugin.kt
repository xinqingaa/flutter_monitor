package com.fluttermonitor.nativebridge

import android.app.Activity
import android.app.ActivityManager
import android.app.Application
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.os.Process
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class FlutterMonitorNativePlugin : FlutterPlugin, MethodChannel.MethodCallHandler, EventChannel.StreamHandler, ComponentCallbacks2, ActivityAware, Application.ActivityLifecycleCallbacks {
  private var context: Context? = null
  private var application: Application? = null
  private var methodChannel: MethodChannel? = null
  private var eventChannel: EventChannel? = null
  private var eventSink: EventChannel.EventSink? = null
  private var activityName: String? = null

  override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    context = binding.applicationContext
    application = binding.applicationContext as? Application
    application?.registerActivityLifecycleCallbacks(this)
    methodChannel = MethodChannel(binding.binaryMessenger, "flutter_monitor_native/methods").also {
      it.setMethodCallHandler(this)
    }
    eventChannel = EventChannel(binding.binaryMessenger, "flutter_monitor_native/events").also {
      it.setStreamHandler(this)
    }
    binding.applicationContext.registerComponentCallbacks(this)
  }

  override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    application?.unregisterActivityLifecycleCallbacks(this)
    binding.applicationContext.unregisterComponentCallbacks(this)
    methodChannel?.setMethodCallHandler(null)
    eventChannel?.setStreamHandler(null)
    methodChannel = null
    eventChannel = null
    eventSink = null
    application = null
    context = null
  }

  override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
    when (call.method) {
      "getResourceSnapshot" -> result.success(resourceSnapshot())
      "getMemorySnapshot" -> result.success(memorySnapshot())
      else -> result.notImplemented()
    }
  }

  override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
    eventSink = events
  }

  override fun onCancel(arguments: Any?) {
    eventSink = null
  }

  override fun onAttachedToActivity(binding: ActivityPluginBinding) {
    activityName = binding.activity::class.java.name
    emitLifecycle(
      callback = "onAttachedToActivity",
      standardState = null,
      rawState = "attached",
    )
  }

  override fun onDetachedFromActivityForConfigChanges() {
    emitLifecycle(
      callback = "onDetachedFromActivityForConfigChanges",
      standardState = null,
      rawState = "detached_for_config_changes",
    )
    activityName = null
  }

  override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
    activityName = binding.activity::class.java.name
    emitLifecycle(
      callback = "onReattachedToActivityForConfigChanges",
      standardState = null,
      rawState = "reattached_for_config_changes",
    )
  }

  override fun onDetachedFromActivity() {
    emitLifecycle(
      callback = "onDetachedFromActivity",
      standardState = null,
      rawState = "detached",
    )
    activityName = null
  }

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
    activityName = activity::class.java.name
    emitLifecycle(
      callback = "onActivityCreated",
      standardState = null,
      rawState = "created",
    )
  }

  override fun onActivityStarted(activity: Activity) {
    activityName = activity::class.java.name
    emitLifecycle(
      callback = "onActivityStarted",
      standardState = null,
      rawState = "started",
    )
  }

  override fun onActivityResumed(activity: Activity) {
    activityName = activity::class.java.name
    emitLifecycle(
      callback = "onActivityResumed",
      standardState = "resumed",
      rawState = "resumed",
    )
  }

  override fun onActivityPaused(activity: Activity) {
    activityName = activity::class.java.name
    emitLifecycle(
      callback = "onActivityPaused",
      standardState = null,
      rawState = "paused",
    )
  }

  override fun onActivityStopped(activity: Activity) {
    activityName = activity::class.java.name
    emitLifecycle(
      callback = "onActivityStopped",
      standardState = null,
      rawState = "stopped",
    )
  }

  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

  override fun onActivityDestroyed(activity: Activity) {
    activityName = activity::class.java.name
    emitLifecycle(
      callback = "onActivityDestroyed",
      standardState = null,
      rawState = "destroyed",
    )
  }

  override fun onConfigurationChanged(newConfig: Configuration) {}

  override fun onLowMemory() {
    emitMemoryPressure(
      pressureLevel = "critical",
      callback = "onLowMemory",
      trimLevel = null,
    )
  }

  override fun onTrimMemory(level: Int) {
    val pressureLevel = when (level) {
      ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL -> "critical"
      ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW,
      ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE -> "moderate"
      else -> "none"
    }
    if (pressureLevel != "none") {
      emitMemoryPressure(
        pressureLevel = pressureLevel,
        callback = "onTrimMemory",
        trimLevel = level,
      )
    } else if (level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
      emitLifecycle(
        callback = "onTrimMemory",
        standardState = null,
        rawState = "ui_hidden",
        extra = mapOf(
          "trimLevel" to level,
          "trimLevelName" to trimLevelName(level),
        ),
      )
    }
  }

  private fun resourceSnapshot(): Map<String, Any?> {
    return mapOf(
      "available" to true,
      "platform" to "android",
      "processId" to Process.myPid(),
      "bridgeVersion" to "0.1.0",
      "signalSource" to "android",
    )
  }

  private fun memorySnapshot(): Map<String, Any?> {
    val runtime = Runtime.getRuntime()
    val heapUsedMb = bytesToMb(runtime.totalMemory() - runtime.freeMemory())
    val heapCapacityMb = bytesToMb(runtime.totalMemory())
    val nativeUsedMb = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      nativeHeapMb()
    } else {
      null
    }

    return mapOf(
      "heapUsedMb" to heapUsedMb,
      "heapCapacityMb" to heapCapacityMb,
      "nativeUsedMb" to nativeUsedMb,
      "sampleSource" to "native",
    ).filterValues { it != null }
  }

  private fun nativeHeapMb(): Double? {
    val appContext = context ?: return null
    val manager = appContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return null
    val info = manager.getProcessMemoryInfo(intArrayOf(Process.myPid())).firstOrNull() ?: return null
    return info.nativePrivateDirty / 1024.0
  }

  private fun emitMemoryPressure(pressureLevel: String, callback: String, trimLevel: Int? = null) {
    val memory = memorySnapshot().toMutableMap()
    memory["pressureLevel"] = pressureLevel
    memory["sampleSource"] = "native"

    eventSink?.success(
      mapOf(
        "type" to "memory",
        "name" to "native.memory.pressure",
        "timestamp" to isoNow(),
        "priority" to "high",
        "resource" to resourceSnapshot(),
        "memory" to memory,
        "payload" to mapOf(
          "platform" to "android",
          "callback" to callback,
          "trimLevel" to trimLevel,
          "trimLevelName" to trimLevel?.let { trimLevelName(it) },
          "rawState" to pressureLevel,
        ).filterValues { it != null },
      )
    )
  }

  private fun emitLifecycle(
    callback: String,
    standardState: String?,
    rawState: String,
    extra: Map<String, Any?> = emptyMap(),
  ) {
    eventSink?.success(
      mapOf(
        "type" to "lifecycle",
        "name" to "native.lifecycle",
        "timestamp" to isoNow(),
        "resource" to resourceSnapshot(),
        "standardLifecycleState" to standardState,
        "payload" to (mapOf(
          "platform" to "android",
          "callback" to callback,
          "activity" to activityName,
          "rawState" to rawState,
        ) + extra).filterValues { it != null },
      )
    )
  }

  private fun trimLevelName(level: Int): String {
    return when (level) {
      ComponentCallbacks2.TRIM_MEMORY_COMPLETE -> "TRIM_MEMORY_COMPLETE"
      ComponentCallbacks2.TRIM_MEMORY_MODERATE -> "TRIM_MEMORY_MODERATE"
      ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> "TRIM_MEMORY_BACKGROUND"
      ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN -> "TRIM_MEMORY_UI_HIDDEN"
      ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL -> "TRIM_MEMORY_RUNNING_CRITICAL"
      ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> "TRIM_MEMORY_RUNNING_LOW"
      ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE -> "TRIM_MEMORY_RUNNING_MODERATE"
      else -> "UNKNOWN"
    }
  }

  private fun bytesToMb(value: Long): Double = value / 1024.0 / 1024.0

  private fun isoNow(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US)
    formatter.timeZone = TimeZone.getDefault()
    return formatter.format(Date())
  }
}
