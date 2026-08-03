import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_pt.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('pt')
  ];

  /// No description provided for @newDeck.
  ///
  /// In pt, this message translates to:
  /// **'Nova apresentação'**
  String get newDeck;

  /// No description provided for @emptyTitle.
  ///
  /// In pt, this message translates to:
  /// **'Sua primeira apresentação'**
  String get emptyTitle;

  /// No description provided for @emptyBody.
  ///
  /// In pt, this message translates to:
  /// **'Descreva o tema — por escrito ou falando — e eu monto os slides, com referências buscadas no PubMed.'**
  String get emptyBody;

  /// No description provided for @serverUnreachable.
  ///
  /// In pt, this message translates to:
  /// **'Não consegui falar com o servidor.'**
  String get serverUnreachable;

  /// No description provided for @retry.
  ///
  /// In pt, this message translates to:
  /// **'Tentar de novo'**
  String get retry;

  /// No description provided for @generating.
  ///
  /// In pt, this message translates to:
  /// **'Gerando…'**
  String get generating;

  /// No description provided for @deckSubtitle.
  ///
  /// In pt, this message translates to:
  /// **'{count} slides · {audience}'**
  String deckSubtitle(int count, String audience);

  /// No description provided for @introTitle.
  ///
  /// In pt, this message translates to:
  /// **'Descreva o tema.\nEu monto os slides.'**
  String get introTitle;

  /// No description provided for @introBody.
  ///
  /// In pt, this message translates to:
  /// **'Escrevo os slides e as notas do apresentador, e busco as referências no PubMed. Nenhuma citação é inventada: sem artigo real, sem referência.'**
  String get introBody;

  /// No description provided for @introMicTitle.
  ///
  /// In pt, this message translates to:
  /// **'Falar em vez de digitar'**
  String get introMicTitle;

  /// No description provided for @introMicBody.
  ///
  /// In pt, this message translates to:
  /// **'A transcrição acontece no próprio aparelho — o áudio não sai daqui, nem quando a frase cita um paciente.'**
  String get introMicBody;

  /// No description provided for @micAllow.
  ///
  /// In pt, this message translates to:
  /// **'Permitir microfone'**
  String get micAllow;

  /// No description provided for @micAsking.
  ///
  /// In pt, this message translates to:
  /// **'Aguardando…'**
  String get micAsking;

  /// No description provided for @micGranted.
  ///
  /// In pt, this message translates to:
  /// **'Microfone liberado'**
  String get micGranted;

  /// No description provided for @start.
  ///
  /// In pt, this message translates to:
  /// **'Começar'**
  String get start;

  /// No description provided for @micDeniedSpeechIntro.
  ///
  /// In pt, this message translates to:
  /// **'Sem reconhecimento de fala. Dá para liberar nos Ajustes depois.'**
  String get micDeniedSpeechIntro;

  /// No description provided for @micDeniedMicrophoneIntro.
  ///
  /// In pt, this message translates to:
  /// **'Sem microfone. Dá para liberar nos Ajustes depois.'**
  String get micDeniedMicrophoneIntro;

  /// No description provided for @micUnavailableIntro.
  ///
  /// In pt, this message translates to:
  /// **'Este aparelho não faz ditado. Digitar funciona igual.'**
  String get micUnavailableIntro;

  /// No description provided for @micFailedIntro.
  ///
  /// In pt, this message translates to:
  /// **'Não consegui pedir agora. Tente depois.'**
  String get micFailedIntro;

  /// No description provided for @micDeniedSpeech.
  ///
  /// In pt, this message translates to:
  /// **'Autorize o reconhecimento de fala nos Ajustes para ditar.'**
  String get micDeniedSpeech;

  /// No description provided for @micDeniedMicrophone.
  ///
  /// In pt, this message translates to:
  /// **'Autorize o microfone nos Ajustes para ditar.'**
  String get micDeniedMicrophone;

  /// No description provided for @micUnavailable.
  ///
  /// In pt, this message translates to:
  /// **'Ditado não está disponível neste aparelho.'**
  String get micUnavailable;

  /// No description provided for @micFailed.
  ///
  /// In pt, this message translates to:
  /// **'Não consegui ouvir. Tente de novo.'**
  String get micFailed;

  /// No description provided for @dictate.
  ///
  /// In pt, this message translates to:
  /// **'Ditar'**
  String get dictate;

  /// No description provided for @stopDictating.
  ///
  /// In pt, this message translates to:
  /// **'Parar'**
  String get stopDictating;

  /// No description provided for @deckFallbackTitle.
  ///
  /// In pt, this message translates to:
  /// **'Apresentação'**
  String get deckFallbackTitle;

  /// No description provided for @share.
  ///
  /// In pt, this message translates to:
  /// **'Compartilhar'**
  String get share;

  /// No description provided for @deckNotFound.
  ///
  /// In pt, this message translates to:
  /// **'Apresentação não encontrada.'**
  String get deckNotFound;

  /// No description provided for @deckGenerateFailed.
  ///
  /// In pt, this message translates to:
  /// **'Não consegui gerar esta apresentação.'**
  String get deckGenerateFailed;

  /// No description provided for @present.
  ///
  /// In pt, this message translates to:
  /// **'Apresentar'**
  String get present;

  /// No description provided for @editWithAi.
  ///
  /// In pt, this message translates to:
  /// **'Editar com IA'**
  String get editWithAi;

  /// No description provided for @slideOfTotal.
  ///
  /// In pt, this message translates to:
  /// **'{index} de {total}'**
  String slideOfTotal(int index, int total);

  /// No description provided for @speakerNotes.
  ///
  /// In pt, this message translates to:
  /// **'Notas do apresentador'**
  String get speakerNotes;

  /// No description provided for @slideReferences.
  ///
  /// In pt, this message translates to:
  /// **'Referências deste slide'**
  String get slideReferences;

  /// No description provided for @presenterHint.
  ///
  /// In pt, this message translates to:
  /// **'Toque nas laterais para avançar · no meio para os controles · arraste para baixo para sair'**
  String get presenterHint;

  /// No description provided for @noNotes.
  ///
  /// In pt, this message translates to:
  /// **'Sem notas neste slide.'**
  String get noNotes;

  /// No description provided for @topicHint.
  ///
  /// In pt, this message translates to:
  /// **'Ex.: sepse na emergência — reconhecimento e primeira hora'**
  String get topicHint;

  /// No description provided for @audienceLabel.
  ///
  /// In pt, this message translates to:
  /// **'Para quem'**
  String get audienceLabel;

  /// No description provided for @slidesLabel.
  ///
  /// In pt, this message translates to:
  /// **'Slides'**
  String get slidesLabel;

  /// No description provided for @depthLabel.
  ///
  /// In pt, this message translates to:
  /// **'Profundidade'**
  String get depthLabel;

  /// No description provided for @depthOverview.
  ///
  /// In pt, this message translates to:
  /// **'Panorama'**
  String get depthOverview;

  /// No description provided for @depthDeep.
  ///
  /// In pt, this message translates to:
  /// **'Aprofundado'**
  String get depthDeep;

  /// No description provided for @generateDeck.
  ///
  /// In pt, this message translates to:
  /// **'Gerar apresentação'**
  String get generateDeck;

  /// No description provided for @audienceResidents.
  ///
  /// In pt, this message translates to:
  /// **'Residentes e internos'**
  String get audienceResidents;

  /// No description provided for @audienceSpecialists.
  ///
  /// In pt, this message translates to:
  /// **'Colegas especialistas (congresso)'**
  String get audienceSpecialists;

  /// No description provided for @audienceTeam.
  ///
  /// In pt, this message translates to:
  /// **'Equipe multiprofissional'**
  String get audienceTeam;

  /// No description provided for @audiencePatients.
  ///
  /// In pt, this message translates to:
  /// **'Pacientes e familiares'**
  String get audiencePatients;

  /// No description provided for @phaseText.
  ///
  /// In pt, this message translates to:
  /// **'Escrevendo os slides'**
  String get phaseText;

  /// No description provided for @phaseReferences.
  ///
  /// In pt, this message translates to:
  /// **'Buscando referências no PubMed'**
  String get phaseReferences;

  /// No description provided for @phaseImages.
  ///
  /// In pt, this message translates to:
  /// **'Escolhendo as imagens'**
  String get phaseImages;

  /// No description provided for @phaseReady.
  ///
  /// In pt, this message translates to:
  /// **'Pronta'**
  String get phaseReady;

  /// No description provided for @scopeSlide.
  ///
  /// In pt, this message translates to:
  /// **'Este slide'**
  String get scopeSlide;

  /// No description provided for @scopeDeck.
  ///
  /// In pt, this message translates to:
  /// **'A apresentação'**
  String get scopeDeck;

  /// No description provided for @scopeSlideNumbered.
  ///
  /// In pt, this message translates to:
  /// **'Slide {index}'**
  String scopeSlideNumbered(int index);

  /// No description provided for @adjustingSlides.
  ///
  /// In pt, this message translates to:
  /// **'Ajustando os slides…'**
  String get adjustingSlides;

  /// No description provided for @adjustingSlide.
  ///
  /// In pt, this message translates to:
  /// **'Ajustando o slide…'**
  String get adjustingSlide;

  /// No description provided for @chatDeckBody.
  ///
  /// In pt, this message translates to:
  /// **'Diga o que quer mudar e eu ajusto os slides — um slide, vários, ou a imagem de um deles. Só mexo no que você pedir.'**
  String get chatDeckBody;

  /// No description provided for @chatSlideBody.
  ///
  /// In pt, this message translates to:
  /// **'Só o slide {index} muda. O resto da apresentação fica como está.'**
  String chatSlideBody(int index);

  /// No description provided for @chatDeckHint.
  ///
  /// In pt, this message translates to:
  /// **'Ex.: deixe o slide 4 mais curto'**
  String get chatDeckHint;

  /// No description provided for @chatSlideHint.
  ///
  /// In pt, this message translates to:
  /// **'Ex.: deixe mais curto e enfatize a dose'**
  String get chatSlideHint;

  /// No description provided for @suggestDeckOne.
  ///
  /// In pt, this message translates to:
  /// **'Adicione 3 slides sobre contraindicações'**
  String get suggestDeckOne;

  /// No description provided for @suggestDeckTwo.
  ///
  /// In pt, this message translates to:
  /// **'No slide 4, enfatize a dose'**
  String get suggestDeckTwo;

  /// No description provided for @suggestDeckThree.
  ///
  /// In pt, this message translates to:
  /// **'Troque a imagem do slide 2'**
  String get suggestDeckThree;

  /// No description provided for @suggestDeckFour.
  ///
  /// In pt, this message translates to:
  /// **'Gere uma ilustração para o slide 3'**
  String get suggestDeckFour;

  /// No description provided for @suggestSlideOne.
  ///
  /// In pt, this message translates to:
  /// **'Deixe mais curto'**
  String get suggestSlideOne;

  /// No description provided for @suggestSlideTwo.
  ///
  /// In pt, this message translates to:
  /// **'Enfatize a dose'**
  String get suggestSlideTwo;

  /// No description provided for @suggestSlideThree.
  ///
  /// In pt, this message translates to:
  /// **'Troque a imagem'**
  String get suggestSlideThree;

  /// No description provided for @suggestSlideFour.
  ///
  /// In pt, this message translates to:
  /// **'Some um exemplo clínico'**
  String get suggestSlideFour;

  /// No description provided for @language.
  ///
  /// In pt, this message translates to:
  /// **'Idioma'**
  String get language;

  /// No description provided for @languageAutomatic.
  ///
  /// In pt, this message translates to:
  /// **'Automático (do aparelho)'**
  String get languageAutomatic;

  /// No description provided for @languagePortuguese.
  ///
  /// In pt, this message translates to:
  /// **'Português'**
  String get languagePortuguese;

  /// No description provided for @languageEnglish.
  ///
  /// In pt, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageNote.
  ///
  /// In pt, this message translates to:
  /// **'Muda a interface e o idioma do ditado. Os slides continuam sendo gerados em português.'**
  String get languageNote;

  /// No description provided for @motionMenu.
  ///
  /// In pt, this message translates to:
  /// **'O que dá para pedir de animação'**
  String get motionMenu;

  /// No description provided for @motionPromptAll.
  ///
  /// In pt, this message translates to:
  /// **'Anime a apresentação inteira'**
  String get motionPromptAll;

  /// No description provided for @motionEffectAll.
  ///
  /// In pt, this message translates to:
  /// **'Escolhe um efeito por slide conforme o layout. Acima de 3 slides ele descreve o plano e espera você confirmar.'**
  String get motionEffectAll;

  /// No description provided for @motionPromptHero.
  ///
  /// In pt, this message translates to:
  /// **'No slide 4, use o efeito herói'**
  String get motionPromptHero;

  /// No description provided for @motionEffectHero.
  ///
  /// In pt, this message translates to:
  /// **'O elemento central chega grande e sozinho, é lido, e então desliza para a esquerda encolhendo enquanto o resto do diagrama aparece. Só em slides com um conceito central.'**
  String get motionEffectHero;

  /// No description provided for @motionPromptMorph.
  ///
  /// In pt, this message translates to:
  /// **'Faça o slide 4 se transformar a partir do slide 3'**
  String get motionPromptMorph;

  /// No description provided for @motionEffectMorph.
  ///
  /// In pt, this message translates to:
  /// **'O que os dois slides têm em comum — um número, um título, uma imagem — voa de uma posição para a outra em vez de sumir e reaparecer. É o Morph do PowerPoint.'**
  String get motionEffectMorph;

  /// No description provided for @motionPromptSteps.
  ///
  /// In pt, this message translates to:
  /// **'No slide 5, revele uma etapa por vez'**
  String get motionPromptSteps;

  /// No description provided for @motionEffectSteps.
  ///
  /// In pt, this message translates to:
  /// **'Cada passo do fluxo entra na ordem em que acontece.'**
  String get motionEffectSteps;

  /// No description provided for @motionPromptNumber.
  ///
  /// In pt, this message translates to:
  /// **'Deixe o número do slide 3 mais solene'**
  String get motionPromptNumber;

  /// No description provided for @motionEffectNumber.
  ///
  /// In pt, this message translates to:
  /// **'O número cresce sozinho, devagar. Bom para a estatística que sustenta o argumento.'**
  String get motionEffectNumber;

  /// No description provided for @motionPromptNone.
  ///
  /// In pt, this message translates to:
  /// **'Tire a animação do slide 8'**
  String get motionPromptNone;

  /// No description provided for @motionEffectNone.
  ///
  /// In pt, this message translates to:
  /// **'Slide parado. Vale usar de propósito: numa apresentação boa a maioria dos slides não se mexe.'**
  String get motionEffectNone;

  /// No description provided for @motionLimitPptx.
  ///
  /// In pt, this message translates to:
  /// **'O movimento é só na tela. O .pptx exportado sai sem animação — o modelo do PowerPoint é outro, e uma tradução pela metade é pior que nenhuma.'**
  String get motionLimitPptx;

  /// No description provided for @motionLimitReduced.
  ///
  /// In pt, this message translates to:
  /// **'Quem tem “reduzir movimento” ligado no sistema vê todos os slides inteiros e parados.'**
  String get motionLimitReduced;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'pt'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'pt':
      return AppLocalizationsPt();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
