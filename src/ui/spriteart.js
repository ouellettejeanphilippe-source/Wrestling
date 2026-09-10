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
  '...........KHHGGGGGGHHK.........',
  '..........KHHGGHHHHHHHhK........',
  '..........KHh4444444443hK.......',
  '..........KHh4444444443hK.......',
  '..........KH444444444443K.......',
  '..........KH44hh444hh443K.......',
  '..........KH44eE444eE443K.......',
  '..........KH4444442444443K......',
  '..........KH44444mm44443K.......',
  '..........KH4444444444333K......',
  '...........K33333333333K........',
  '............KK3333333KK.........',
  '..............K33333K...........',
  '..........KKKK33333333KKKK......',
  '.........K444K33333333K444K.....',
  '.........K444K32333323K444K.....',
  '.........K444K33333333K444K.....',
  '.........K344K33333333K443K.....',
  '.........K344K33333333K443K.....',
  '..........K44K33333333K44K......',
  '..........K44KK333333KK44K......',
  '..........K44KBAAAAAAaK44K......',
  '..........K44KBAAAAAAaK44K......',
  '..........KKKKBAAAAAAaKKKK......',
  '..............BAAaKAAaK.........',
  '..............BAaKKAAaK.........',
  '.............KK334KK334KK.......',
  '.............K334K.K334K........',
  '.............K334K.K334K........',
  '.............K334K.K334K........',
  '.............K233K.K233K........',
  '............KKVVVKKKVVVKK.......',
  '............KWVVVKKKVVVWK.......',
  '............KVVVbKKKbVVVK.......',
  '............KKKKKKKKKKKKK.......',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];
