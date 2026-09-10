// ---------------------------------------------------------------------------
// PLANCHES DE SPRITES DESSINÉES À LA MAIN
//
// Chaque sprite est une grille de caractères : un caractère = un pixel, posé à
// la main. Aucun calcul de forme, aucun rectangle empilé — c'est un vrai dessin,
// lu comme une planche de pixel art classique.
//
// Les caractères ne sont pas des couleurs mais des EMPLACEMENTS de palette :
// le même dessin sert à tout le roster, chacun avec sa peau, ses cheveux, sa
// tenue et ses bottes. C'est la méthode « palette swap » des jeux 2D.
//
//   .  transparent          K  contour (encre)
//   1  peau ombre profonde  2  peau ombre    3  peau base   4  peau claire   5  peau éclat
//   h  cheveux ombre        H  cheveux base  G  cheveux clair
//   a  tenue ombre          A  tenue base    B  tenue claire
//   n  accent ombre         N  accent base
//   b  bottes ombre         V  bottes base   W  bottes claire
//   e  blanc de l'œil       E  iris          m  bouche
//   w  blanc                o  noir doux (sangles, gants)
// ---------------------------------------------------------------------------

export const ART_W = 32;
export const ART_H = 48;

// Archétype « poids léger / technicien », trois-quarts avant, tourné vers la droite.
export const BASE_FRONT = [
  '................................',
  '................................',
  '..............KKKKKK............',
  '............KKHHHHHHKK..........',
  '...........KHHGGGGGHHHK.........',
  '...........KHGGHHHHHHhK.........',
  '...........KHh4444443hK.........',
  '...........KHh444444 3K.........',
  '...........KH4hh43hh43K.........',
  '...........KH4eE43eE43K.........',
  '...........KH44332 443K.........',
  '...........KH443m22343K.........',
  '............K33333332K..........',
  '............KK32223KK...........',
  '...........KK3333333KK..........',
  '........KKK443333333344KKK......',
  '.......K4444K3333333K4444K......',
  '.......K3444K3334333K4443K......',
  '.......K3444K2334332K4443K......',
  '.......K3444K3334333K4443K......',
  '........K344K2334332K444K.......',
  '........K344K3334333K444K.......',
  '........K344K2334332K444K.......',
  '........K344K3334333K444K.......',
  '.........K44K2333332K44K........',
  '.........K44KK33333KK44K........',
  '.........K44KBAAAAAaK44K........',
  '.........K44KBAAAAAaK44K........',
  '..........KKKBAAAAAaKKK.........',
  '............KBAAaAAaK...........',
  '............KBAaKKAaK...........',
  '...........KK334KK334KK.........',
  '...........K3334K.K3334K........',
  '...........K3334K.K3334K........',
  '...........K3334K.K3334K........',
  '...........K2334K.K2334K........',
  '...........K2334K.K2334K........',
  '...........K2233K.K2233K........',
  '...........K2233K.K2233K........',
  '..........KKVVVVKKKVVVVKK.......',
  '..........KWVVVVKKKVVVVWK.......',
  '..........KVVVVbKKKbVVVVK.......',
  '..........KWVVVVKKKVVVVWK.......',
  '..........KVVVVbKKKbVVVVK.......',
  '..........KKKKKKKKKKKKKKK.......',
  '................................',
  '................................',
  '................................',
];
