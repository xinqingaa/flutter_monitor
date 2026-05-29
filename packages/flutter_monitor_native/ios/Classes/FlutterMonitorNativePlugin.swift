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
      selector: #selector(didBecomeActive),
      name: UIApplication.didBecomeActiveNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(willResignActive),
      name: UIApplication.willResignActiveNotification,
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
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(willTerminate),
      name: UIApplication.willTerminateNotification,
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
    emitMemoryPressure(level: "critical", notification: "UIApplication.didReceiveMemoryWarningNotification")
  }

  @objc private func didBecomeActive() {
    emitLifecycle(
      notification: "UIApplication.didBecomeActiveNotification",
      standardState: "resumed",
      rawState: "active"
    )
  }

  @objc private func willResignActive() {
    emitLifecycle(
      notification: "UIApplication.willResignActiveNotification",
      standardState: "inactive",
      rawState: "inactive"
    )
  }

  @objc private func didEnterBackground() {
    emitLifecycle(
      notification: "UIApplication.didEnterBackgroundNotification",
      standardState: nil,
      rawState: "background"
    )
  }

  @objc private func willEnterForeground() {
    emitLifecycle(
      notification: "UIApplication.willEnterForegroundNotification",
      standardState: nil,
      rawState: "foreground"
    )
  }

  @objc private func willTerminate() {
    emitLifecycle(
      notification: "UIApplication.willTerminateNotification",
      standardState: nil,
      rawState: "terminated"
    )
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

  private func emitMemoryPressure(level: String, notification: String) {
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
        "platform": "ios",
        "notification": notification,
        "applicationState": applicationStateName(),
        "rawState": level,
      ],
    ])
  }

  private func emitLifecycle(notification: String, standardState: String?, rawState: String) {
    var event: [String: Any] = [
      "type": "lifecycle",
      "name": "native.lifecycle",
      "timestamp": isoNow(),
      "resource": resourceSnapshot(),
      "payload": [
        "platform": "ios",
        "notification": notification,
        "applicationState": applicationStateName(),
        "rawState": rawState,
      ],
    ]
    if let standardState = standardState {
      event["standardLifecycleState"] = standardState
    }
    eventSink?(event)
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

  private func applicationStateName() -> String {
    switch UIApplication.shared.applicationState {
    case .active:
      return "active"
    case .inactive:
      return "inactive"
    case .background:
      return "background"
    @unknown default:
      return "unknown"
    }
  }
}
