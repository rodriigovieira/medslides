// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get newDeck => 'New deck';

  @override
  String get emptyTitle => 'Your first deck';

  @override
  String get emptyBody =>
      'Describe the topic — typed or spoken — and I\'ll build the slides, with references looked up on PubMed.';

  @override
  String get serverUnreachable => 'I couldn\'t reach the server.';

  @override
  String get retry => 'Try again';

  @override
  String get generating => 'Building…';

  @override
  String deckSubtitle(int count, String audience) {
    return '$count slides · $audience';
  }

  @override
  String get introTitle => 'Describe the topic.\nI\'ll build the slides.';

  @override
  String get introBody =>
      'I write the slides and the speaker notes, and look the references up on PubMed. No citation is invented: no real paper, no reference.';

  @override
  String get introMicTitle => 'Speak instead of typing';

  @override
  String get introMicBody =>
      'Transcription happens on the device itself — the audio never leaves it, not even when the sentence names a patient.';

  @override
  String get micAllow => 'Allow microphone';

  @override
  String get micAsking => 'Waiting…';

  @override
  String get micGranted => 'Microphone allowed';

  @override
  String get start => 'Get started';

  @override
  String get micDeniedSpeechIntro =>
      'No speech recognition. You can allow it in Settings later.';

  @override
  String get micDeniedMicrophoneIntro =>
      'No microphone. You can allow it in Settings later.';

  @override
  String get micUnavailableIntro =>
      'This device can\'t dictate. Typing works just as well.';

  @override
  String get micFailedIntro => 'I couldn\'t ask just now. Try again later.';

  @override
  String get micDeniedSpeech =>
      'Allow speech recognition in Settings to dictate.';

  @override
  String get micDeniedMicrophone =>
      'Allow the microphone in Settings to dictate.';

  @override
  String get micUnavailable => 'Dictation isn\'t available on this device.';

  @override
  String get micFailed => 'I didn\'t catch that. Try again.';

  @override
  String get dictate => 'Dictate';

  @override
  String get stopDictating => 'Stop';

  @override
  String get deckFallbackTitle => 'Deck';

  @override
  String get share => 'Share';

  @override
  String get deckNotFound => 'Deck not found.';

  @override
  String get deckGenerateFailed => 'I couldn\'t build this deck.';

  @override
  String get present => 'Present';

  @override
  String get editWithAi => 'Edit with AI';

  @override
  String slideOfTotal(int index, int total) {
    return '$index of $total';
  }

  @override
  String get speakerNotes => 'Speaker notes';

  @override
  String get slideReferences => 'References on this slide';

  @override
  String get presenterHint =>
      'Tap the sides to move · the middle for controls · swipe down to leave';

  @override
  String get noNotes => 'No notes on this slide.';

  @override
  String get topicHint =>
      'e.g. sepsis in the ED — recognition and the first hour';

  @override
  String get audienceLabel => 'Audience';

  @override
  String get slidesLabel => 'Slides';

  @override
  String get depthLabel => 'Depth';

  @override
  String get depthOverview => 'Overview';

  @override
  String get depthDeep => 'In depth';

  @override
  String get generateDeck => 'Build the deck';

  @override
  String get audienceResidents => 'Residents and interns';

  @override
  String get audienceSpecialists => 'Fellow specialists (conference)';

  @override
  String get audienceTeam => 'Multidisciplinary team';

  @override
  String get audiencePatients => 'Patients and families';

  @override
  String get phaseText => 'Writing the slides';

  @override
  String get phaseReferences => 'Looking up references on PubMed';

  @override
  String get phaseImages => 'Choosing the images';

  @override
  String get phaseReady => 'Ready';

  @override
  String get scopeSlide => 'This slide';

  @override
  String get scopeDeck => 'Whole deck';

  @override
  String scopeSlideNumbered(int index) {
    return 'Slide $index';
  }

  @override
  String get adjustingSlides => 'Adjusting the slides…';

  @override
  String get adjustingSlide => 'Adjusting the slide…';

  @override
  String get chatDeckBody =>
      'Tell me what to change and I\'ll adjust the slides — one, several, or the picture on one of them. I only touch what you ask for.';

  @override
  String chatSlideBody(int index) {
    return 'Only slide $index changes. The rest of the deck stays as it is.';
  }

  @override
  String get chatDeckHint => 'e.g. make slide 4 shorter';

  @override
  String get chatSlideHint => 'e.g. make it shorter and stress the dose';

  @override
  String get suggestDeckOne => 'Add 3 slides on contraindications';

  @override
  String get suggestDeckTwo => 'On slide 4, stress the dose';

  @override
  String get suggestDeckThree => 'Swap the picture on slide 2';

  @override
  String get suggestDeckFour => 'Generate an illustration for slide 3';

  @override
  String get suggestSlideOne => 'Make it shorter';

  @override
  String get suggestSlideTwo => 'Stress the dose';

  @override
  String get suggestSlideThree => 'Swap the picture';

  @override
  String get suggestSlideFour => 'Add a clinical example';

  @override
  String get language => 'Language';

  @override
  String get languageAutomatic => 'Automatic (device)';

  @override
  String get languagePortuguese => 'Português';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageNote =>
      'Changes the interface and the dictation language. Slides are still generated in Portuguese.';
}
