package com.fluttermonitor.nativebridge

import android.app.ActivityManager
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.Process
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.Locale

class FlutterMonitorNativePlugin : FlutterPlugin, MethodChannel.MethodCallHandler, EventChannel.StreamHandler, ComponentCallbacks2 {
  private var context: Context? = null
  private var methodChannel: MethodChannel? = null
  private var eventChannel: EventChannel? = null
  private var eventSink: EventChannel.EventSink? = null

  override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    context = binding.applicationContext
    methodChannel = MethodChannel(binding.binaryMessenger, "flutter_monitor_native/methods").also {
      it.setMethodCallHandler(this)
    }
    eventChannel = EventChannel(binding.binaryMessenger, "flutter_monitor_native/events").also {
      it.setStreamHandler(this)
    }
    binding.applicationContext.registerComponentCallbacks(this)
  }

  override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    binding.applicationContext.unregisterComponentCallbacks(this)
    methodChannel?.setMethodCallHandler(null)
    eventChannel?.setStreamHandler(null)
    methodChannel = null
    eventChannel = null
    eventSink = null
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

  override fun onConfigurationChanged(newConfig: Configuration) {}

  override fun onLowMemory() {
    emitMemoryPressure("critical")
  }

  override fun onTrimMemory(level: Int) {
    val pressureLevel = when {
      level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL -> "critical"
      level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> "moderate"
      level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> "moderate"
      else -> "none"
    }
    if (pressureLevel != "none") {
      emitMemoryPressure(pressureLevel, trimLevel = level)
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

  private fun emitMemoryPressure(pressureLevel: String, trimLevel: Int? = null) {
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
          "android.trim_level" to trimLevel,
        ).filterValues { it != null },
      )
    )
  }

  private fun bytesToMb(value: Long): Double = value / 1024.0 / 1024.0

  private fun isoNow(): String {
    val millis = System.currentTimeMillis()
    val seconds = millis / 1000
    val ms = millis % 1000
    return String.format(Locale.US, "%tFT%<tT.%03d%<tz", seconds * 1000, ms)
  }
}
