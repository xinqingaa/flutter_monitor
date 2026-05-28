import Flutter
import UIKit
import MachO

public class FlutterMonitorNativePlugin: NSObject, FlutterPlugin, FlutterStreamHandler {
  private var eventSink: FlutterEventSink?

  public static func register(with registrar: FlutterPluginRegistrar) {
    let instance = FlutterMonitorNativePlugin()
    let methodChannel = FlutterMethodChannel(
      name: "flutter_monitor_native/methods",
      binaryMessenger: registrar.messenger()
    )
    let eventChannel = FlutterEventChannel(
      name: "flutter_monitor_native/events",
      binaryMessenger: registrar.messenger()
    )
    registrar.addMethodCallDelegate(instance, channel: methodChannel)
    eventChannel.setStreamHandler(instance)
  }

  public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "getResourceSnapshot":
      result(resourceSnapshot())
    case "getMemorySnapshot":
      result(memorySnapshot())
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  public func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    eventSink = events
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(didReceiveMemoryWarning),
      name: UIApplication.didReceiveMemoryWarningNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(didEnterBackground),
      name: UIApplication.didEnterBackgroundNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(willEnterForeground),
      name: UIApplication.willEnterForegroundNotification,
      object: nil
    )
    return nil
  }

  public func onCancel(withArguments arguments: Any?) -> FlutterError? {
    NotificationCenter.default.removeObserver(self)
    eventSink = nil
    return nil
  }

  @objc private func didReceiveMemoryWarning() {
    emitMemoryPressure(level: "critical")
  }

  @objc private func didEnterBackground() {
    emitLifecycle(state: "background")
  }

  @objc private func willEnterForeground() {
    emitLifecycle(state: "foreground")
  }

  private func resourceSnapshot() -> [String: Any] {
    return [
      "available": true,
      "platform": "ios",
      "processId": ProcessInfo.processInfo.processIdentifier,
      "bridgeVersion": "0.1.0",
      "signalSource": "ios",
    ]
  }

  private func memorySnapshot() -> [String: Any] {
    var result: [String: Any] = [
      "sampleSource": "native",
    ]
    if let resident = residentMemoryMb() {
      result["rssMb"] = resident
      result["nativeUsedMb"] = resident
    }
    return result
  }

  private func emitMemoryPressure(level: String) {
    var memory = memorySnapshot()
    memory["pressureLevel"] = level
    memory["sampleSource"] = "native"
    eventSink?([
      "type": "memory",
      "name": "native.memory.pressure",
      "timestamp": isoNow(),
      "priority": "high",
      "resource": resourceSnapshot(),
      "memory": memory,
      "payload": [
        "ios.notification": "UIApplication.didReceiveMemoryWarningNotification",
      ],
    ])
  }

  private func emitLifecycle(state: String) {
    eventSink?([
      "type": "lifecycle",
      "name": "native.lifecycle",
      "timestamp": isoNow(),
      "resource": resourceSnapshot(),
      "attributes": [
        "context.lifecycle.state": state,
      ],
    ])
  }

  private func residentMemoryMb() -> Double? {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size) / 4
    let result = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    guard result == KERN_SUCCESS else {
      return nil
    }
    return Double(info.phys_footprint) / 1024.0 / 1024.0
  }

  private func isoNow() -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: Date())
  }
}
