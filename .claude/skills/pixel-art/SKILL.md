---
name: pixel-art
description: >-
  Règles et méthode pour dessiner, corriger ou juger du pixel art dans ce dépôt
  — sprites de lutteurs, palettes, contours, postures, animations de repos.
  À charger AVANT de toucher à src/ui/spriteart.js, src/ui/spritepixel.js, au
  générateur de planches, ou à quoi que ce soit qui produise des pixels. À
  charger aussi dès qu'on parle de « sprites laids », de rendre un personnage
  reconnaissable, de lui donner de la personnalité, de changer une palette, un
  contour, une silhouette ou une carrure — même si le mot « pixel art » n'est
  jamais prononcé. Contient le catalogue des erreurs déjà commises sur ce
  projet : les relire évite de les refaire.
---

# Pixel art — méthode et pièges de ce projet

Ce fichier existe parce que les mêmes erreurs revenaient : extrapoler une
règle trop loin, changer cinq variables à la fois, juger un sprite zoomé, et
ne découvrir la faute qu'au rendu suivant.

## La méthode, avant les règles

Les règles esthétiques plus bas ne servent à rien si le processus dérape.
Quatre habitudes, dans l'ordre d'importance.

**1. Une variable à la fois, puis on regarde.** Le pixel art n'est pas
prévisible par le raisonnement : un réglage qui semble juste sur le papier
donne des coups de soleil, des cheveux gris ou des épines le long des jambes.
Changer la rotation de teinte ET la luminosité ET la saturation dans la même
passe rend impossible de savoir lequel des trois a cassé le résultat.

**2. Juger à la taille réelle.** Un sprite s'affiche à la taille d'une case
— ici 44 px de haut. Zoomé à 300 px, tout paraît grossier et on corrige des
défauts que personne ne verra, pendant qu'on rate ceux qui comptent. Rendre
les deux, toujours, et sur fond clair ET sombre : un contour qui tient sur le
tapis beige disparaît sur le plancher violet.

**3. Faire ce que la référence FAIT, pas ce qu'on en déduit.** C'est l'erreur
la plus coûteuse commise ici. Observer « le contour de Crono n'est pas noir »
et en déduire « donc il s'éclaircit du côté éclairé » était faux : il est
*coloré* et il *s'ouvre dans les cheveux*, rien de plus. L'éclaircir gonflait
chaque jambe d'une colonne grise. Devant une référence, décrire ce qui est
là — pas la règle générale qu'on imagine derrière.

**4. Mesurer plutôt qu'estimer.** `scripts/measure.mjs` compte les couleurs,
l'étendue de luminosité par matière et la plus longue arête droite. « Ça
manque de contraste » n'est pas actionnable ; « les cheveux couvrent 0,38 de
luminosité quand la référence en couvre 0,85 » l'est.

## Couleur

**Un dégradé tourne, il ne va pas du noir au blanc.** `mix(couleur, noir)` et
`mix(couleur, blanc)` font perdre la saturation aux deux bouts, exactement là
où l'œil la cherche : ombres grises, lumières délavées. C'est la signature de
l'amateur. L'ombre glisse vers le bleu-violet **en gagnant** de la
saturation, la lumière glisse vers le jaune et en perd un peu.

Quatre réglages, et se tromper sur l'un d'eux casse tout :

| réglage | valeur qui marche | ce qui arrive sinon |
|---|---|---|
| rotation de teinte | ≤ 14° | à 40° la peau vire au rouge pur, le bleu s'écroule au noir |
| luminosité | **proportionnelle** (`l × (1−k)`) | soustraction fixe : les couleurs sombres s'écrasent au noir plat |
| gain de saturation | sur la **marge restante** | gain additif : la peau, déjà saturée, part en néon |
| plafond du reflet | **absolu** | proportionnel : une matière sombre a trop de marge, ses cheveux noirs prennent un reflet gris |

**Dépenser la palette sur la caractéristique signature.** Les cheveux de
Crono couvrent cinq valeurs pendant que sa peau n'en a que deux. Répartir
équitablement donne un personnage sans accent. Chercher ce qui identifie le
personnage et lui donner l'amplitude.

**L'encre n'est jamais noire.** Un prune très sombre intègre le sprite au
décor ; un noir pur l'y colle comme un autocollant.

**La peau est la matière la plus sensible.** Ses écarts restent plus faibles
que ceux des tissus : l'œil y repère le moindre excès.

## Forme

**La silhouette d'abord, et une seule chose doit casser le rectangle.** On
reconnaît un personnage à son contour avant sa couleur. Une chevelure, un
chapeau à large bord, la crête d'un masque. Une boîte sur la tête ne suffit
pas.

**Aucune arête ne reste droite plus de trois ou quatre lignes** — sinon une
jambe lit comme un tuyau. Mais *casser une arête ne veut pas dire changer de
largeur à chaque ligne* : cinq marches en sept lignes donnent des encoches
tous les deux pixels, c'est du bruit. Trois largeurs franches valent mieux —
cuisse, genou, mollet.

**Le contour suit la silhouette, il ne cerne jamais un membre.** Un bras
cerné sur ses quatre côtés donne une poupée articulée. C'est l'ombre qui
détache un bras d'un torse.

**Le torse est plus large que la tête.** L'inverse donne une tête d'épingle
sur des épaules molles.

**Un membre fait au moins deux pixels de couleur.** À un pixel, c'est un fil.

**L'ombre d'un vêtement se pose sur ses bords et sous son ourlet.** Deux
pixels sombres isolés au milieu d'un aplat lisent comme des boutons, pas
comme un pli.

## Échelle

**Plus petit vaut mieux.** Un sprite de personnage tient dans 24×32. Au-delà
on est tenté de détailler, et le détail devient de la bouillie à la taille
d'une case. La contrainte force des formes franches — et à surface d'écran
égale, chaque pixel est plus gros, donc plus lisible.

**Trois tons par matière, pas cinq.** Un dégradé fin ne se lit pas à cette
résolution : il se salit.

**Un geste ne se lit que s'il change franchement la silhouette.** Une main à
plat devant le visage passe. Un doigt qui lisse une moustache devient une
tache : deux pixels cerclés d'encre, c'est de l'encre.

## Animation

**Un sprite immobile a l'air mort**, quelle que soit la qualité du dessin.
C'est souvent ce qui manque quand « c'est correct mais pas beau ».

Deux mécanismes, de coûts très différents. Le **mouvement** déplace tout le
sprite en CSS — gratuit, et il suffit pour l'essentiel d'un roster. Les
**images dessinées** changent le dessin lui-même ; elles se réservent aux
gestes qui *sont* le personnage. `steps()` partout : une interpolation
continue donne un glissement sous-pixel qui trahit le pixel art.

**Un geste dessiné est une SUITE d'images, jamais deux.** Avec une seule image
en plus, la main apparaît et disparaît : ça clignote, ça ne balaie pas. Trois
ou quatre images, l'image 0 comprise — un geste continu n'a pas de moment où
la main n'est nulle part. Le coût n'est pas le dessin, c'est la relecture :
quatre images à juger à la taille réelle, c'est quatre fois le travail.

Les images sont empilées et le CSS les fait défiler, chacune visible pendant
sa tranche du cycle. Pas de `setInterval` par pion : dix pions dérivent les uns
par rapport aux autres et le coût monte.

Ce que ce mécanisme ne sait pas faire : un **cycle inégal**. Un clignement des
yeux dure 100 ms toutes les 4 secondes, pas un quart du cycle — il lui faudrait
son propre rapport cyclique, donc sa propre animation.

Un repos « immobile » reste une respiration minuscule, jamais zéro.

## Système contre dessin à la main

L'échange de palette — un corps partagé, des couches posées dessus — est ce
qui permet à un grand roster d'exister. Son plafond : tout le monde se tient
pareil.

Sortir un personnage du système vaut le coup **pour sa pose**, pas pour son
rendu. Une planche dessinée à la main obtient une asymétrie que le système
interdit, mais elle sera moins bien dessinée que la générée, parce que le
système a la régularité. Si le besoin est « mieux dessiné », corriger le
système : ça profite à tout le monde d'un coup.

Essayé, puis retiré. La planche vedette de Hogan avait le torse trois
colonnes à droite de la tête, les hanches à mi-chemin, un bras plus écarté
que l'autre — et pas de vue de dos. Le même personnage repassé par une
**posture** (`triomphe`) garde les bras levés et récupère d'un coup
l'alignement, les vêtements qui tombent juste et l'ombrage du corps. Une pose
se dessine donc comme une posture, jamais comme un corps de plus.

## Catalogue des erreurs déjà commises

À relire avant de se lancer — chacune a coûté une passe complète.

- **Cerner chaque membre d'encre.** Symptôme : poupée articulée, bonhomme Lego.
- **Ligne médiane du torse qui change de colonne d'une ligne à l'autre.**
  Symptôme : cicatrice en zigzag du sternum au nombril.
- **Ombre pectorale horizontale plus ligne médiane verticale.** Symptôme :
  une croix visible sous les t-shirts.
- **Compter les colonnes à la main.** Symptôme : tout est décalé d'un pixel.
  Remède : un constructeur de ligne qui centre par calcul, et une
  vérification automatique de largeur, palette et centrage.
- **Œil collé au contour du crâne.** Symptôme : dalle noire au bord de la
  tête. Remède : profiter du trois-quarts — œil du fond à un pixel, œil de
  devant à deux, et de la peau avant le contour.
- **Bouche de deux pixels dans un visage de six.** Symptôme : barre brune.
- **Corps du colosse sans version de dos.** Symptôme : il garde son visage en
  tournant le dos à la caméra.
- **Planches qui ne posent pas le pied sur la même ligne.** Symptôme : le
  lutteur sautille d'un pixel quand il se retourne.
- **Dessiner à la main sans réserver un budget de colonnes par masse.**
  Symptôme : le bras chevauche la tête.
- **Supposer que le corps est centré entre deux colonnes.** Il est centré
  **sur la colonne 11**, pas sur 11,5 : le miroir d'une colonne `x` est
  `22 - x`. Symptôme : une posture symétrique sur le papier dont un bras se
  soude à l'épaule et l'autre reste séparé par une colonne d'encre. Les six
  premières postures avaient toutes la faute. Remède : ne plus jamais écrire
  le côté droit — `sym()` le calcule.
- **Découper les bras sans reposer le contour du torse.** Le contour vivait
  sur la colonne extérieure du bras : la coupe l'emportait avec. Symptôme :
  un t-shirt sans bord, qui bave sur le fond, sur toutes les lignes que la
  posture ne redessine pas.
- **Empiler les deux bras d'une posture dissymétrique à la suite dans une
  liste.** La liste est positionnelle : le second bras descend d'autant de
  lignes que le premier en occupe. Symptôme : un bras détaché, cinq lignes
  trop bas. Remède : déclarer la planche par NUMÉRO de ligne (`lignes({...})`).
- **Donner un bras levé à quelqu'un qui tient quelque chose.** Les accessoires
  de main (`bat`, `skateboard`, `beer`, `bottle`, `teeth_jar`) sont des
  couches posées aux colonnes 16-19, lignes 9-17 : la main par défaut. Une
  posture qui lève ce bras laisse la batte flotter à côté du corps — et la
  couche, posée après, mange le bras. Symptôme : Stung au micro avec sa batte
  en travers de l'avant-bras.
- **Poser l'image de repos avant les couches de tête.** Les casquettes, les
  cheveux et les masques sont dessinés en dernier : une main devant le visage
  passait dessous et il n'en restait qu'un bout de poignet sous la joue. Les
  gestes de repos se posent **après tout le reste**.
- **Une main aussi large que le crâne.** Elle n'efface pas le visage, elle le
  remplace : le sprite devient une tête vide. La paume fait la moitié de la
  largeur du crâne, et il lui faut un ton clair au milieu — deux aplats de
  peau côte à côte ne se distinguent que par leur contour, et un contour ne
  suffit pas.
- **Garder le coude fixe pendant que la main bouge.** L'avant-bras se
  retrouve coupé en deux morceaux décalés. Tout le bras glisse ensemble.
- **Juger une planche à l'œil au lieu de lire la grille composée.** Les deux
  fautes ci-dessus étaient invisibles au rendu et évidentes en texte. Rendre
  la grille après composition — base + posture + visage + vêtements — et la
  lire ligne par ligne coûte une minute.

## Où ça vit, dans ce dépôt

- `src/ui/spriteart.js` — les planches, **généré** : ne pas éditer à la main.
- Le générateur vit dans le répertoire de travail temporaire de la session
  (`gen2.py`). Il valide largeur, palette et centrage de chaque ligne, et
  produit la table des colonnes du torse depuis le dessin lui-même, pour
  qu'elle ne puisse pas dériver.
- `src/ui/spritepixel.js` — palette, vêtements peints sur la peau, postures,
  expressions, contour, composition.
- `src/data/wrestlers.js` — par lutteur : `look.build`, `look.stance`,
  `look.face`, `look.idle`, couleurs et caractéristiques.

## Vérifier

```bash
node .claude/skills/pixel-art/scripts/measure.mjs          # tout le roster
node .claude/skills/pixel-art/scripts/measure.mjs gunter   # un lutteur
npm test
```

Et toujours, avant de déclarer que c'est mieux : rendre la planche de contact
**à la taille réelle et en grand**, et la regarder.
