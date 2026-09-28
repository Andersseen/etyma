import type { MessageSource } from '@etyma/core';

/**
 * A small slice of Andersseen/my-blog's catalogs in the shape they had before its Etyma
 * migration (`a11928d^`), when `home.editorialPoints` and `about.paragraphs` were arrays. The
 * migration had to rewrite them as `editorialPoint1`... / `paragraph1`... because
 * `MessageSource` had no array support; this fixture is the shape that should have just worked.
 * Paragraphs are trimmed to their first sentence; `footer.rights` is the post-migration MF2
 * string, for a variable next to the arrays.
 */
export const myBlogEs = {
  home: {
    editorialPoints: [
      'Arquitectura frontend escalable',
      'Experimentos reales con Angular y Web Components',
      'Tips de tooling, DX y calidad de codigo',
      'Contenido alineado con Andersseen Dev',
    ],
  },
  about: {
    paragraphs: [
      'Este blog esta disenado para crecer sin friccion.',
      'La UI esta construida con componentes Astro modulares, sin JavaScript por defecto.',
    ],
  },
  footer: {
    rights: '© {$year :number useGrouping=never} {$author}. Todos los derechos reservados.',
  },
} satisfies MessageSource;

export const myBlogEn = {
  home: {
    editorialPoints: [
      'Scalable frontend architecture',
      'Real experiments with Angular and Web Components',
      'Tooling, DX and code quality insights',
      'Content aligned with Andersseen Dev',
    ],
  },
  about: {
    paragraphs: [
      'This blog is designed to scale without friction.',
      'The UI is built with modular Astro components, zero JavaScript by default.',
    ],
  },
  footer: { rights: '© {$year :number useGrouping=never} {$author}. All rights reserved.' },
} satisfies MessageSource;

export const myBlogUk = {
  home: {
    editorialPoints: [
      'Масштабована frontend-архітектура',
      'Реальні експерименти з Angular та Web Components',
      'Підходи до tooling, DX і якості коду',
      'Контент, узгоджений з Andersseen Dev',
    ],
  },
  about: {
    paragraphs: [
      'Цей блог створено для зростання без тертя.',
      'UI побудований на модульних компонентах Astro без JavaScript за замовчуванням.',
    ],
  },
  footer: { rights: '© {$year :number useGrouping=never} {$author}. Усі права захищено.' },
} satisfies MessageSource;
