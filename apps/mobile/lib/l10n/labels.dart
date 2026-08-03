import '../dictation/dictation_service.dart';
import '../models/deck.dart';
import 'app_localizations.dart';

/// Labels for values that are **not** ours to translate at the point of use.
///
/// An audience and a phase both travel over the wire as fixed Portuguese
/// strings — the audience because the backend puts it verbatim into the
/// prompt, the phase because it is a stored enum. Translating them where they
/// are sent would change what the server receives; translating them here
/// changes only what the reader sees.
extension AudienceLabels on AppLocalizations {
  String audience(String canonical) => switch (canonical) {
        'Residentes e internos' => audienceResidents,
        'Colegas especialistas (congresso)' => audienceSpecialists,
        'Equipe multiprofissional' => audienceTeam,
        'Pacientes e familiares' => audiencePatients,
        // A deck made on the web, or before this list changed, can carry an
        // audience we have no translation for. Its own words beat a blank.
        _ => canonical,
      };

  String phase(DeckPhase value) => switch (value) {
        DeckPhase.texto => phaseText,
        DeckPhase.referencias => phaseReferences,
        DeckPhase.imagens => phaseImages,
        DeckPhase.pronto => phaseReady,
      };

  /// The sentence shown when dictation will not start, in the composer.
  String dictationProblem(DictationError error) => switch (error) {
        DictationError.speechDenied => micDeniedSpeech,
        DictationError.microphoneDenied => micDeniedMicrophone,
        DictationError.unavailable => micUnavailable,
        DictationError.failed => micFailed,
      };

  /// The same four failures, phrased for the intro — where nothing is broken
  /// yet and typing is still a perfectly good answer.
  String dictationProblemAtIntro(DictationError error) => switch (error) {
        DictationError.speechDenied => micDeniedSpeechIntro,
        DictationError.microphoneDenied => micDeniedMicrophoneIntro,
        DictationError.unavailable => micUnavailableIntro,
        DictationError.failed => micFailedIntro,
      };
}
