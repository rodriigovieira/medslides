import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    // Dictation is hand-rolled rather than a pub package: it needs
    // SFSpeechRecognizer's on-device recogniser and a custom language model
    // biased with medical vocabulary, neither of which the published plugins
    // expose. See ios/Runner/Dictation.swift.
    if let registrar = engineBridge.pluginRegistry.registrar(
      forPlugin: "MedSlidesDictation")
    {
      DictationPlugin.register(with: registrar)
    }
  }
}
