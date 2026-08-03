// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get newDeck => 'Nova apresentação';

  @override
  String get emptyTitle => 'Sua primeira apresentação';

  @override
  String get emptyBody =>
      'Descreva o tema — por escrito ou falando — e eu monto os slides, com referências buscadas no PubMed.';

  @override
  String get serverUnreachable => 'Não consegui falar com o servidor.';

  @override
  String get retry => 'Tentar de novo';

  @override
  String get generating => 'Gerando…';

  @override
  String deckSubtitle(int count, String audience) {
    return '$count slides · $audience';
  }

  @override
  String get introTitle => 'Descreva o tema.\nEu monto os slides.';

  @override
  String get introBody =>
      'Escrevo os slides e as notas do apresentador, e busco as referências no PubMed. Nenhuma citação é inventada: sem artigo real, sem referência.';

  @override
  String get introMicTitle => 'Falar em vez de digitar';

  @override
  String get introMicBody =>
      'A transcrição acontece no próprio aparelho — o áudio não sai daqui, nem quando a frase cita um paciente.';

  @override
  String get micAllow => 'Permitir microfone';

  @override
  String get micAsking => 'Aguardando…';

  @override
  String get micGranted => 'Microfone liberado';

  @override
  String get start => 'Começar';

  @override
  String get micDeniedSpeechIntro =>
      'Sem reconhecimento de fala. Dá para liberar nos Ajustes depois.';

  @override
  String get micDeniedMicrophoneIntro =>
      'Sem microfone. Dá para liberar nos Ajustes depois.';

  @override
  String get micUnavailableIntro =>
      'Este aparelho não faz ditado. Digitar funciona igual.';

  @override
  String get micFailedIntro => 'Não consegui pedir agora. Tente depois.';

  @override
  String get micDeniedSpeech =>
      'Autorize o reconhecimento de fala nos Ajustes para ditar.';

  @override
  String get micDeniedMicrophone =>
      'Autorize o microfone nos Ajustes para ditar.';

  @override
  String get micUnavailable => 'Ditado não está disponível neste aparelho.';

  @override
  String get micFailed => 'Não consegui ouvir. Tente de novo.';

  @override
  String get dictate => 'Ditar';

  @override
  String get stopDictating => 'Parar';

  @override
  String get deckFallbackTitle => 'Apresentação';

  @override
  String get share => 'Compartilhar';

  @override
  String get deckNotFound => 'Apresentação não encontrada.';

  @override
  String get deckGenerateFailed => 'Não consegui gerar esta apresentação.';

  @override
  String get present => 'Apresentar';

  @override
  String get editWithAi => 'Editar com IA';

  @override
  String slideOfTotal(int index, int total) {
    return '$index de $total';
  }

  @override
  String get speakerNotes => 'Notas do apresentador';

  @override
  String get slideReferences => 'Referências deste slide';

  @override
  String get presenterHint =>
      'Toque nas laterais para avançar · no meio para os controles · arraste para baixo para sair';

  @override
  String get noNotes => 'Sem notas neste slide.';

  @override
  String get topicHint =>
      'Ex.: sepse na emergência — reconhecimento e primeira hora';

  @override
  String get audienceLabel => 'Para quem';

  @override
  String get slidesLabel => 'Slides';

  @override
  String get depthLabel => 'Profundidade';

  @override
  String get depthOverview => 'Panorama';

  @override
  String get depthDeep => 'Aprofundado';

  @override
  String get generateDeck => 'Gerar apresentação';

  @override
  String get audienceResidents => 'Residentes e internos';

  @override
  String get audienceSpecialists => 'Colegas especialistas (congresso)';

  @override
  String get audienceTeam => 'Equipe multiprofissional';

  @override
  String get audiencePatients => 'Pacientes e familiares';

  @override
  String get phaseText => 'Escrevendo os slides';

  @override
  String get phaseReferences => 'Buscando referências no PubMed';

  @override
  String get phaseImages => 'Escolhendo as imagens';

  @override
  String get phaseReady => 'Pronta';

  @override
  String get scopeSlide => 'Este slide';

  @override
  String get scopeDeck => 'A apresentação';

  @override
  String scopeSlideNumbered(int index) {
    return 'Slide $index';
  }

  @override
  String get adjustingSlides => 'Ajustando os slides…';

  @override
  String get adjustingSlide => 'Ajustando o slide…';

  @override
  String get chatDeckBody =>
      'Diga o que quer mudar e eu ajusto os slides — um slide, vários, ou a imagem de um deles. Só mexo no que você pedir.';

  @override
  String chatSlideBody(int index) {
    return 'Só o slide $index muda. O resto da apresentação fica como está.';
  }

  @override
  String get chatDeckHint => 'Ex.: deixe o slide 4 mais curto';

  @override
  String get chatSlideHint => 'Ex.: deixe mais curto e enfatize a dose';

  @override
  String get suggestDeckOne => 'Adicione 3 slides sobre contraindicações';

  @override
  String get suggestDeckTwo => 'No slide 4, enfatize a dose';

  @override
  String get suggestDeckThree => 'Troque a imagem do slide 2';

  @override
  String get suggestDeckFour => 'Gere uma ilustração para o slide 3';

  @override
  String get suggestSlideOne => 'Deixe mais curto';

  @override
  String get suggestSlideTwo => 'Enfatize a dose';

  @override
  String get suggestSlideThree => 'Troque a imagem';

  @override
  String get suggestSlideFour => 'Some um exemplo clínico';

  @override
  String get language => 'Idioma';

  @override
  String get languageAutomatic => 'Automático (do aparelho)';

  @override
  String get languagePortuguese => 'Português';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageNote =>
      'Muda a interface e o idioma do ditado. Os slides continuam sendo gerados em português.';

  @override
  String get motionMenu => 'O que dá para pedir de animação';

  @override
  String get motionPromptAll => 'Anime a apresentação inteira';

  @override
  String get motionEffectAll =>
      'Escolhe um efeito por slide conforme o layout. Acima de 3 slides ele descreve o plano e espera você confirmar.';

  @override
  String get motionPromptHero => 'No slide 4, use o efeito herói';

  @override
  String get motionEffectHero =>
      'O elemento central chega grande e sozinho, é lido, e então desliza para a esquerda encolhendo enquanto o resto do diagrama aparece. Só em slides com um conceito central.';

  @override
  String get motionPromptMorph =>
      'Faça o slide 4 se transformar a partir do slide 3';

  @override
  String get motionEffectMorph =>
      'O que os dois slides têm em comum — um número, um título, uma imagem — voa de uma posição para a outra em vez de sumir e reaparecer. É o Morph do PowerPoint.';

  @override
  String get motionPromptSteps => 'No slide 5, revele uma etapa por vez';

  @override
  String get motionEffectSteps =>
      'Cada passo do fluxo entra na ordem em que acontece.';

  @override
  String get motionPromptNumber => 'Deixe o número do slide 3 mais solene';

  @override
  String get motionEffectNumber =>
      'O número cresce sozinho, devagar. Bom para a estatística que sustenta o argumento.';

  @override
  String get motionPromptNone => 'Tire a animação do slide 8';

  @override
  String get motionEffectNone =>
      'Slide parado. Vale usar de propósito: numa apresentação boa a maioria dos slides não se mexe.';

  @override
  String get motionLimitPptx =>
      'O movimento é só na tela. O .pptx exportado sai sem animação — o modelo do PowerPoint é outro, e uma tradução pela metade é pior que nenhuma.';

  @override
  String get motionLimitReduced =>
      'Quem tem “reduzir movimento” ligado no sistema vê todos os slides inteiros e parados.';
}
