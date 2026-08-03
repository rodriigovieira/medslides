import AVFoundation
import Flutter
import Foundation
import Speech

/// On-device dictation for the composer.
///
/// This is the same Apple speech stack the keyboard's microphone key drives,
/// but reached directly so we can bias it toward the vocabulary this user
/// actually types. Three knobs the keyboard does not expose:
///
///   - `contextualStrings`: a short bias list of project nouns.
///   - `customizedLanguageModel`: an iOS 17 custom language model trained from
///     the user's own phrasing, which goes well beyond a bias list.
///   - `requiresOnDeviceRecognition`: keeps audio on the device and removes
///     Apple's roughly one-minute server-side session cap.
///
/// The vocabulary is mined locally by
/// `apps/mobile/scripts/mine_dictation_vocabulary.py`; nothing is uploaded.
final class DictationPlugin: NSObject {
  private static let methodChannelName = "medslides/dictation"
  private static let eventChannelName = "medslides/dictation/events"

  /// Apple degrades when `contextualStrings` is flooded - it is a bias list,
  /// not a dictionary. The miner already ranks terms, so we take the head.
  private static let maxContextualStrings = 100

  /// Rebuilt whenever Dart asks for a different language — see `useLocale`.
  /// A recogniser is bound to one locale at construction, so following the
  /// app's language means replacing it, not configuring it.
  private var recognizer: SFSpeechRecognizer?

  /// Which locale `recognizer` was built for, so switching back and forth
  /// between the two app languages does not rebuild it on every tap.
  private var recognizerLocale: String?
  private let audioEngine = AVAudioEngine()

  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var events: FlutterEventSink?

  /// True from `start` until the user stops. iOS ends a recognition task on its
  /// own after roughly a minute; while this is set, that ends only the *task*,
  /// not the session - a fresh task is opened over the same, still-running
  /// audio engine. Rotating here rather than in Dart is deliberate: restarting
  /// from Dart tore down the audio session and re-subscribed the event channel
  /// each time, and the old subscription's cancel raced the new one's sink.
  private var running = false

  /// Settings for the session, replayed onto each rotated task.
  private var contextualStrings: [String] = []
  private var addsPunctuation = true
  private var preferOnDevice = true

  /// The newest partial transcript of the current task. A task that times out
  /// reports an *error*, not a final, so anything said since the last final
  /// exists only here - banking it on rotation is what stops the transcript
  /// being gutted at the seam.
  private var latestPartial = ""

  /// Did the recogniser start a new utterance inside the same task?
  ///
  /// `bestTranscription.formattedString` is NOT cumulative for the life of a
  /// task. After a pause, iOS begins a fresh utterance and the string restarts
  /// from zero, dropping everything before it — with no `isFinal` and no error,
  /// so nothing in the rotation path ever fires. Telemetry caught it directly:
  /// a 140-character partial replaced by a 9-character one, same generation,
  /// nothing in between. Detecting it here is what stops a pause mid-sentence
  /// erasing the sentence.
  ///
  /// A genuine revision keeps its prefix (`"the backend"` -> `"the back end"`)
  /// or shortens to a prefix of itself. A restart shares neither, and collapses
  /// to a fraction of the length.
  private func isUtteranceRestart(previous: String, next: String) -> Bool {
    guard previous.count >= 15 else { return false }
    guard next.count * 2 < previous.count else { return false }
    return !previous.hasPrefix(next)
  }

  /// Identifies the current task. A finished task can fire its callback more
  /// than once - typically a final, then an error - and acting on the second
  /// rotates a task that is already gone, leaving two live recognisers writing
  /// transcripts that both start from zero. The stale one then overwrites the
  /// banked text. Callbacks carry the generation they were opened with and
  /// anything stale is dropped.
  private var generation = 0

  /// Consecutive task failures that produced no transcript. A single failure is
  /// a normal rotation; a run of them means the recogniser is wedged and the
  /// session should surface an error instead of spinning.
  private var barrenRotations = 0
  private var lastRotationAt: TimeInterval = 0

  /// Prepared custom language model, if one was built successfully. Optional by
  /// design: every failure path here falls back to contextual strings alone.
  private var languageModel: SFSpeechLanguageModel.Configuration?

  override init() {
    // Starts on the phone's own setting. Dart overrides this with the app's
    // resolved language before listening — dictating in the language the
    // interface is in is the whole point, and someone running the app in
    // Portuguese on an English phone was previously transcribed as English,
    // which produces confident nonsense rather than an obvious failure.
    self.recognizer = SFSpeechRecognizer(locale: Locale.current)
      ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    self.recognizerLocale = self.recognizer?.locale.identifier
    super.init()
  }

  /// Point the recogniser at `identifier` (e.g. "pt-BR", "en-US").
  ///
  /// Falls back to the phone's locale, then to en-US, because a device
  /// without that language installed returns nil rather than throwing, and a
  /// nil recogniser reads to the user as dictation being broken.
  private func useLocale(_ identifier: String?) {
    guard let identifier, !identifier.isEmpty else { return }
    guard identifier != recognizerLocale else { return }
    guard let next = SFSpeechRecognizer(locale: Locale(identifier: identifier))
    else { return }
    recognizer = next
    recognizerLocale = identifier
  }

  static func register(with registrar: FlutterPluginRegistrar) {
    let plugin = DictationPlugin()
    let methods = FlutterMethodChannel(
      name: methodChannelName, binaryMessenger: registrar.messenger())
    methods.setMethodCallHandler { call, result in
      plugin.handle(call, result: result)
    }
    FlutterEventChannel(name: eventChannelName, binaryMessenger: registrar.messenger())
      .setStreamHandler(plugin)
  }

  // MARK: - Method dispatch

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "authorize":
      authorize(result: result)
    case "prepare":
      let args = call.arguments as? [String: Any] ?? [:]
      let phrases = args["phrases"] as? [String] ?? []
      let version = args["version"] as? String ?? "1"
      prepareLanguageModel(phrases: phrases, version: version, result: result)
    case "start":
      let args = call.arguments as? [String: Any] ?? [:]
      useLocale(args["locale"] as? String)
      start(
        contextualStrings: args["contextualStrings"] as? [String] ?? [],
        onDevice: args["onDevice"] as? Bool ?? true,
        punctuation: args["punctuation"] as? Bool ?? true,
        result: result)
    case "stop":
      stop(result: result)
    case "cancel":
      cancel(result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  // MARK: - Permissions

  /// Dictation needs two separate grants: speech recognition and the mic.
  private func authorize(result: @escaping FlutterResult) {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else {
        DispatchQueue.main.async { result("speech_denied") }
        return
      }
      AVAudioApplication.requestRecordPermission { granted in
        DispatchQueue.main.async { result(granted ? "granted" : "microphone_denied") }
      }
    }
  }

  // MARK: - Custom language model

  /// Build (once per vocabulary version) an on-device language model from the
  /// user's own sentences.
  ///
  /// Training is measured in seconds and the result is cached on disk, so the
  /// version string carries a hash of the phrase set - change the vocabulary
  /// and it retrains, otherwise it loads.
  private func prepareLanguageModel(
    phrases: [String], version: String, result: @escaping FlutterResult
  ) {
    guard !phrases.isEmpty else {
      result(false)
      return
    }

    let identifier = "com.pandapdv.pandacode.dictation"
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let modelURL = support.appendingPathComponent("dictation-\(version).bin")

    Task {
      do {
        try FileManager.default.createDirectory(
          at: support, withIntermediateDirectories: true)

        if !FileManager.default.fileExists(atPath: modelURL.path) {
          // Drop stale versions so the container does not accumulate models.
          let stale = (try? FileManager.default.contentsOfDirectory(
            at: support, includingPropertiesForKeys: nil)) ?? []
          for url in stale where url.lastPathComponent.hasPrefix("dictation-") {
            try? FileManager.default.removeItem(at: url)
          }

          let data = SFCustomLanguageModelData(
            locale: self.recognizer?.locale ?? Locale(identifier: "en-US"),
            identifier: identifier,
            version: version
          ) {
            for phrase in phrases {
              SFCustomLanguageModelData.PhraseCount(phrase: phrase, count: 1)
            }
          }
          try await data.export(to: modelURL)
        }

        let configuration = SFSpeechLanguageModel.Configuration(languageModel: modelURL)
        try await SFSpeechLanguageModel.prepareCustomLanguageModel(
          for: modelURL, clientIdentifier: identifier, configuration: configuration)

        self.languageModel = configuration
        DispatchQueue.main.async { result(true) }
      } catch {
        // Non-fatal: dictation still runs with contextual strings only.
        NSLog("[dictation] custom language model unavailable: \(error.localizedDescription)")
        self.languageModel = nil
        DispatchQueue.main.async { result(false) }
      }
    }
  }

  // MARK: - Recognition

  private func start(
    contextualStrings: [String], onDevice: Bool, punctuation: Bool,
    result: @escaping FlutterResult
  ) {
    guard let recognizer, recognizer.isAvailable else {
      result(FlutterError(
        code: "unavailable", message: "Speech recognition is unavailable.", details: nil))
      return
    }

    // Starting twice would stack taps on the input node and crash.
    teardown()

    self.contextualStrings = Array(contextualStrings.prefix(Self.maxContextualStrings))
    self.addsPunctuation = punctuation
    self.preferOnDevice = onDevice
    self.barrenRotations = 0

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.record, mode: .measurement, options: .duckOthers)
      try session.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      result(FlutterError(
        code: "audio_session", message: error.localizedDescription, details: nil))
      return
    }

    // The tap is installed once and feeds whichever request is current, so a
    // task rotation is invisible to the audio path - no gap, no dropped words.
    let input = audioEngine.inputNode
    // Always tap with the node's own format; a mismatch is a hard crash.
    let format = input.outputFormat(forBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }

    audioEngine.prepare()
    do {
      try audioEngine.start()
    } catch {
      teardown()
      result(FlutterError(
        code: "audio_engine", message: error.localizedDescription, details: nil))
      return
    }

    running = true
    beginTask()
    result(nil)
  }

  /// Open one recognition task over the already-running audio engine.
  private func beginTask() {
    guard let recognizer, running else { return }

    latestPartial = ""
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.addsPunctuation = addsPunctuation
    // Bias toward this user's project nouns. Truncated because an oversized
    // list measurably degrades general accuracy.
    request.contextualStrings = contextualStrings

    // A custom language model is only honoured on-device, so it forces the flag.
    if let languageModel {
      request.customizedLanguageModel = languageModel
      request.requiresOnDeviceRecognition = true
    } else {
      request.requiresOnDeviceRecognition =
        preferOnDevice && recognizer.supportsOnDeviceRecognition
    }
    self.request = request

    generation += 1
    let mine = generation
    trace("native.task_start", gen: mine,
          note: request.requiresOnDeviceRecognition ? "onDevice" : "server")

    task = recognizer.recognitionTask(with: request) { [weak self] recognition, error in
      guard let self, mine == self.generation else { return }

      if let recognition {
        let text = recognition.bestTranscription.formattedString
        if recognition.isFinal {
          // End of an utterance - a pause, usually. Banked by Dart and never
          // revised again. `segment` deliberately does not end the session:
          // only an explicit stop does, so a break mid-thought is safe.
          self.trace("native.final", gen: mine, textLen: text.count)
          self.rotate(banking: text.isEmpty ? self.latestPartial : text,
                      clean: true)
        } else {
          if self.isUtteranceRestart(previous: self.latestPartial, next: text) {
            // Bank the old utterance before the new one overwrites it. This is
            // the only place it can be saved: no final is coming for it.
            self.trace("native.utterance_restart", gen: mine,
                       textLen: self.latestPartial.count,
                       note: "next=\(text.count)")
            self.emit(["type": "segment", "text": self.latestPartial])
          }
          self.latestPartial = text
          self.emit(["type": "partial", "text": text])
          self.trace("native.partial", gen: mine, textLen: text.count)
        }
        return
      }

      if let error {
        let ns = error as NSError
        self.trace("native.error", gen: mine, textLen: self.latestPartial.count,
                   note: "\(ns.domain):\(ns.code)")
        // A timed-out task reports an error rather than a clean final - the
        // ordinary end of a long utterance, not a failure. Bank the newest
        // partial: it holds everything said since the last final, and the next
        // task starts its transcript from zero, so discarding it here is
        // exactly the "it restarted and I lost what I said" bug.
        self.rotate(banking: self.latestPartial, clean: false)
      }
    }
  }

  /// End the current task and, if the user is still speaking, open the next one.
  private func rotate(banking text: String?, clean: Bool) {
    task = nil
    latestPartial = ""
    // `request` is deliberately left in place until `beginTask` replaces it:
    // the audio tap appends to whatever it points at, so nilling it here would
    // drop every buffer captured during the changeover - a clipped word at
    // each seam.

    trace("native.rotate", gen: generation, textLen: text?.count ?? 0,
          note: clean ? "clean" : "error")

    if let text, !text.isEmpty {
      barrenRotations = 0
      emit(["type": "segment", "text": text])
    } else if clean {
      // Silence. A pause is not a failure - the whole point of rotating is to
      // sit through one and keep listening.
      barrenRotations = 0
    } else {
      // Only a *rapid* run of empty errors means the recogniser is wedged.
      // Counting slow ones punished ordinary silence and tore the session down
      // mid-thought.
      let now = Date().timeIntervalSinceReferenceDate
      barrenRotations = (now - lastRotationAt) < 0.3 ? barrenRotations + 1 : 1
      lastRotationAt = now
    }

    guard running else { return }

    guard barrenRotations < 5 else {
      trace("native.wedged", gen: generation, note: "barren=\(barrenRotations)")
      emit(["type": "error", "message": "Speech recognition stopped responding."])
      teardown()
      return
    }

    beginTask()
  }

  /// Close the audio stream and let the recogniser flush a final transcript.
  private func stop(result: @escaping FlutterResult) {
    // Clear first so the task ending below is not mistaken for a rotation.
    trace("native.stop_requested", gen: generation)
    running = false
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    request?.endAudio()

    // The in-flight task still owes its last words; give it a moment to flush
    // before tearing the session down, then close the stream either way.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
      guard let self else { return }
      self.emit(["type": "final", "text": ""])
      self.teardown()
    }
    result(nil)
  }

  /// Abandon the utterance without emitting a final transcript.
  private func cancel(result: @escaping FlutterResult) {
    teardown()
    result(nil)
  }

  private func teardown() {
    trace("native.teardown", gen: generation)
    running = false
    task?.cancel()
    task = nil
    request = nil
    if audioEngine.isRunning { audioEngine.stop() }
    audioEngine.inputNode.removeTap(onBus: 0)
    try? AVAudioSession.sharedInstance().setActive(
      false, options: .notifyOthersOnDeactivation)
  }

  /// Diagnostics. Carries counts and task generations only - never transcript
  /// text - so it can cross the relay without breaking the E2E rule.
  private func trace(_ event: String, gen: Int? = nil, textLen: Int? = nil, note: String? = nil) {
    var payload: [String: Any] = ["type": "trace", "event": event]
    if let gen { payload["gen"] = gen }
    if let textLen { payload["textLen"] = textLen }
    if let note { payload["note"] = note }
    emit(payload)
  }

  private func emit(_ payload: [String: Any]) {
    DispatchQueue.main.async { self.events?(payload) }
  }
}

// MARK: - Event stream

extension DictationPlugin: FlutterStreamHandler {
  func onListen(
    withArguments arguments: Any?, eventSink: @escaping FlutterEventSink
  ) -> FlutterError? {
    events = eventSink
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    events = nil
    return nil
  }
}
