# Adaptedl

Photographie une page de manuel de français, la lit sur l'appareil, en tire les
exercices et les propose à l'élève sous forme d'étiquettes à glisser, avec
lecture vocale. À la fin, une fiche PDF d'une ou deux pages avec ses réponses.

**Aucune connexion, aucune clé API.** L'OCR (Tesseract) et le moteur vocal
tournent sur l'iPad.

## Installation

1. Pousser tout le dossier dans un dépôt GitHub, activer GitHub Pages.
2. Ouvrir l'adresse **une fois avec du réseau** : les 10 Mo du moteur de
   lecture se mettent en cache.
3. Sur iPad : Partager → « Sur l'écran d'accueil ». L'application s'ouvre
   ensuite sans réseau.

Le premier `file://` ne fonctionne pas : il faut un serveur (GitHub Pages, ou
`python3 -m http.server` en local) pour que le service worker et les web
workers démarrent.

## Ce que l'analyse sait faire

| Consigne du manuel | Devient |
|---|---|
| complète, remplace, écris, conjugue | trous + étiquettes |
| souligne, entoure, coche, barre, relève | l'élève touche les mots |
| classe, range, trie | colonnes + étiquettes |
| recopie, transforme, mets au pluriel | écarté, motif affiché |

La structure est reconstruite sur le **verbe de consigne en tête de ligne** et
les repères `a.` `b.` `c.` : dans les manuels récents les numéros d'exercices
sont des pastilles dessinées, invisibles à l'OCR.

Les trous sont repérés à l'écartement des mots, pas aux pointillés : l'OCR les
avale presque toujours.

Quand la consigne ne donne pas la liste des mots (« complète avec le
déterminant qui convient »), les étiquettes viennent d'un lexique embarqué de
classes grammaticales fermées (déterminants, pronoms, prépositions,
conjonctions, auxiliaires, négation, ponctuation) et restent réutilisables.

## Deux moteurs d'analyse

- **Analyser sur l'appareil** : Tesseract, hors ligne, sans compte. Convertit
  les exercices de français denses en texte, écarte le reste avec un motif.
- **Analyser avec l'IA** : via Puter.js, sans clé API — le script est chargé
  depuis `js.puter.com`, la page part chez Puter puis chez un fournisseur de
  modèle. Lit les colonnes et les pastilles dessinées que l'OCR ne voit pas.
  Demande du réseau ; le bouton se désactive tout seul hors ligne. Gratuit au
  départ, puis lié à un compte Puter (modèle « User-Pays »).

Un modèle peut se tromper d'un mot : l'écran d'aperçu avant de passer l'iPad
à l'élève n'est pas décoratif.

## Si la lecture se trompe

« Corriger ce qui a été lu » ouvre l'atelier, prérempli, avec une syntaxe à
crochets : `Le [chat] dort.` Rien n'oblige à y passer.

## Fichiers

- `index.html` — application
- `analyse.js` — OCR → exercices (testable sous node)
- `sw.js` — cache hors ligne
- `vendor/` — Tesseract, modèle français, pdf.js
