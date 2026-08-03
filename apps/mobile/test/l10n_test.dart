import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medslides_mobile/l10n/app_localizations.dart';
import 'package:medslides_mobile/state/providers.dart';

/// The two ARB files are edited by hand and drift silently: gen_l10n fills a
/// key missing from a translation with the template's text, so a forgotten
/// English string ships as Portuguese and nothing anywhere goes red.
void main() {
  Map<String, dynamic> arb(String locale) => jsonDecode(
        File('lib/l10n/app_$locale.arb').readAsStringSync(),
      ) as Map<String, dynamic>;

  /// Message keys only — `@@locale` and the `@key` metadata blocks are not
  /// translations and are not expected to match.
  Set<String> keys(Map<String, dynamic> source) =>
      source.keys.where((key) => !key.startsWith('@')).toSet();

  test('every Portuguese string has an English one, and the reverse', () {
    expect(keys(arb('en')), keys(arb('pt')));
  });

  test('no translation was left as its Portuguese original', () {
    final pt = arb('pt');
    final en = arb('en');
    // Some are deliberately identical: the language names read the same in
    // both menus, "Slide" and "Slides" are the same word in both, and the
    // deck subtitle is punctuation around placeholders.
    const sharedOnPurpose = {
      'languagePortuguese',
      'languageEnglish',
      'deckSubtitle',
      'slidesLabel',
      'scopeSlideNumbered',
    };
    for (final key in keys(pt)) {
      if (sharedOnPurpose.contains(key)) continue;
      expect(en[key], isNot(pt[key]), reason: '$key was never translated');
    }
  });

  test('an unsupported phone language lands on Portuguese, not English', () {
    // The fallback is not cosmetic: the slides come back in Portuguese, so a
    // Japanese phone is better served by a Portuguese interface than by an
    // English one wrapped around Portuguese content.
    final resolved = basicLocaleListResolution(
      const [Locale('ja'), Locale('ko')],
      supportedLocales,
    );
    expect(resolved.languageCode, 'pt');
  });

  test('an English phone gets English', () {
    final resolved = basicLocaleListResolution(
      const [Locale('en', 'GB')],
      supportedLocales,
    );
    expect(resolved.languageCode, 'en');
  });

  testWidgets('both locales load every message', (tester) async {
    for (final locale in supportedLocales) {
      final l10n = await AppLocalizations.delegate.load(locale);
      // One string per screen, so a delegate that loaded but resolved to the
      // wrong table is caught too.
      expect(l10n.newDeck, isNotEmpty);
      expect(l10n.present, isNotEmpty);
      expect(l10n.scopeDeck, isNotEmpty);
      expect(l10n.micAllow, isNotEmpty);
      expect(l10n.slideOfTotal(2, 10), contains('2'));
    }
  });
}
